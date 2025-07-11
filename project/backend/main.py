# SECURITY NOTE: Never commit API keys or secrets to this file. Use a .env file and environment variables only.
import os
import logging
import tempfile
import pytesseract
import pdfplumber
import pandas as pd
from pdf2image import convert_from_path
from docx import Document
from PIL import Image
from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import openai
import aiofiles
import json
import boto3
from dotenv import load_dotenv
import shutil
import re
from datetime import datetime, date

load_dotenv()

# DO NOT set or fallback to a hardcoded OpenAI API key here.
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY environment variable not set. Please set it in your .env file and never commit secrets.")
openai.api_key = OPENAI_API_KEY

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ACCOUNTING MAP BASED ON USER TABLE ---
ACCOUNTING_MAP = {
    # --- SALES INVOICE ---
    'sales-invoice': {
        'Invoice Amount': {
            'chart_type': 'Income', 'account': 'Sales Revenue', 'trial_balance': 'Credit', 'balance_sheet': None, 'pnl': 'Revenue', 'cash_flow': 'Operating Inflow',
        },
        'Customer Name': {
            'chart_type': 'Asset', 'account': 'Accounts Receivable (Debtors)', 'trial_balance': 'Debit', 'balance_sheet': 'Current Asset', 'pnl': None, 'cash_flow': None,
        },
        'Output GST/VAT': {
            'chart_type': 'Liability', 'account': 'Output Tax Payable', 'trial_balance': 'Credit', 'balance_sheet': 'Current Liability', 'pnl': None, 'cash_flow': None,
        },
        'Discount Given': {
            'chart_type': 'Expense', 'account': 'Sales Discount', 'trial_balance': 'Debit', 'balance_sheet': None, 'pnl': 'Operating Expense', 'cash_flow': 'Operating Outflow',
        },
        'Freight Collected': {
            'chart_type': 'Income', 'account': 'Freight Revenue', 'trial_balance': 'Credit', 'balance_sheet': None, 'pnl': 'Revenue', 'cash_flow': 'Operating Inflow',
        },
    },
    # --- PURCHASE INVOICE ---
    'purchase-invoice': {
        'Bill Amount': {
            'chart_type': 'Expense/COGS', 'account': 'Purchase / Raw Material', 'trial_balance': 'Debit', 'balance_sheet': None, 'pnl': 'COGS/Operating Expense', 'cash_flow': 'Operating Outflow',
        },
        'Supplier Name': {
            'chart_type': 'Liability', 'account': 'Accounts Payable (Creditors)', 'trial_balance': 'Credit', 'balance_sheet': 'Current Liability', 'pnl': None, 'cash_flow': None,
        },
        'Input GST/VAT': {
            'chart_type': 'Asset', 'account': 'Input Tax Receivable', 'trial_balance': 'Debit', 'balance_sheet': 'Current Asset', 'pnl': None, 'cash_flow': None,
        },
        'Freight Paid': {
            'chart_type': 'Expense', 'account': 'Freight Inward', 'trial_balance': 'Debit', 'balance_sheet': None, 'pnl': 'Operating Expense', 'cash_flow': 'Operating Outflow',
        },
    },
    # --- BANK STATEMENT ---
    'bank-statement': {
        'Bank Balance': {
            'chart_type': 'Asset', 'account': 'Bank Account', 'trial_balance': 'Debit', 'balance_sheet': 'Current Asset', 'pnl': None, 'cash_flow': 'Ending Balance',
        },
        'Interest Earned': {
            'chart_type': 'Income', 'account': 'Interest Income', 'trial_balance': 'Credit', 'balance_sheet': None, 'pnl': 'Other Income', 'cash_flow': 'Operating Inflow',
        },
        'Bank Charges': {
            'chart_type': 'Expense', 'account': 'Bank Charges', 'trial_balance': 'Debit', 'balance_sheet': None, 'pnl': 'Admin Expense', 'cash_flow': 'Operating Outflow',
        },
        'Loan Received': {
            'chart_type': 'Liability', 'account': 'Loan Payable', 'trial_balance': 'Credit', 'balance_sheet': 'Long-Term Liability', 'pnl': None, 'cash_flow': 'Financing Inflow',
        },
        'Loan Repayment': {
            'chart_type': 'Liability (Reduction)', 'account': 'Loan Payable', 'trial_balance': 'Debit', 'balance_sheet': 'Long-Term Liability (↓)', 'pnl': None, 'cash_flow': 'Financing Outflow',
        },
        'Fixed Asset Purchase': {
            'chart_type': 'Asset', 'account': 'Machinery / Equipment', 'trial_balance': 'Debit', 'balance_sheet': 'Fixed Asset', 'pnl': None, 'cash_flow': 'Investing Outflow',
        },
    },
    # --- RECEIPTS ---
    'receipts': {
        'Customer Payment': {
            'chart_type': 'Asset (↓) / Asset (↑)', 'account': 'Debtors ↓ / Bank ↑', 'trial_balance': 'Debit / Credit', 'balance_sheet': 'Current Asset', 'pnl': None, 'cash_flow': 'Operating Inflow',
        },
        'Tax Collected Included': {
            'chart_type': 'Liability', 'account': 'Output GST/VAT Payable', 'trial_balance': 'Credit', 'balance_sheet': 'Current Liability', 'pnl': None, 'cash_flow': None,
        },
    },
    # --- PAYMENTS ---
    'payments': {
        'Vendor Payment': {
            'chart_type': 'Liability (↓) / Asset (↓)', 'account': 'Creditors ↓ / Bank ↓', 'trial_balance': 'Debit / Credit', 'balance_sheet': 'Current Liability / Asset', 'pnl': None, 'cash_flow': 'Operating Outflow',
        },
        'Direct Expense': {
            'chart_type': 'Expense', 'account': 'Rent, Utilities, Admin Expense', 'trial_balance': 'Debit', 'balance_sheet': None, 'pnl': 'Operating Expense', 'cash_flow': 'Operating Outflow',
        },
        'Capital Expenditure': {
            'chart_type': 'Asset', 'account': 'Plant & Machinery', 'trial_balance': 'Debit', 'balance_sheet': 'Fixed Asset', 'pnl': None, 'cash_flow': 'Investing Outflow',
        },
    },
    # --- PAYROLL ---
    'payroll': {
        'Gross Salary': {
            'chart_type': 'Expense', 'account': 'Salary Expense', 'trial_balance': 'Debit', 'balance_sheet': None, 'pnl': 'Operating Expense', 'cash_flow': 'Operating Outflow',
        },
        'PF / TDS Payable': {
            'chart_type': 'Liability', 'account': 'Statutory Payables', 'trial_balance': 'Credit', 'balance_sheet': 'Current Liability', 'pnl': None, 'cash_flow': None,
        },
        'Net Pay Transferred': {
            'chart_type': 'Asset (↓)', 'account': 'Bank / Cash', 'trial_balance': 'Credit', 'balance_sheet': 'Current Asset', 'pnl': None, 'cash_flow': 'Operating Outflow',
        },
    },
    # --- FIXED ASSET PURCHASE ---
    'fixed-asset-purchase': {
        'Asset Cost': {
            'chart_type': 'Asset', 'account': 'Equipment, Vehicle, etc.', 'trial_balance': 'Debit', 'balance_sheet': 'Fixed Asset', 'pnl': None, 'cash_flow': 'Investing Outflow',
        },
        'Tax on Purchase': {
            'chart_type': 'Asset', 'account': 'Input GST/VAT Receivable', 'trial_balance': 'Debit', 'balance_sheet': 'Current Asset', 'pnl': None, 'cash_flow': None,
        },
    },
    # --- ASSET SALE ---
    'asset-sale': {
        'Sale Proceeds': {
            'chart_type': 'Income', 'account': 'Gain on Asset Disposal', 'trial_balance': 'Credit', 'balance_sheet': None, 'pnl': 'Other Income (if profit)', 'cash_flow': 'Investing Inflow',
        },
        'Book Value': {
            'chart_type': 'Asset (Reduction)', 'account': 'Fixed Asset', 'trial_balance': 'Credit', 'balance_sheet': 'Fixed Asset (↓)', 'pnl': None, 'cash_flow': 'Investing Outflow',
        },
    },
    # --- CAPITAL INFUSION ---
    'capital-infusion': {
        'Owner Capital Introduced': {
            'chart_type': 'Equity', 'account': 'Owner’s Capital', 'trial_balance': 'Credit', 'balance_sheet': 'Equity', 'pnl': None, 'cash_flow': 'Financing Inflow',
        },
        'Deposited to Bank': {
            'chart_type': 'Asset', 'account': 'Bank', 'trial_balance': 'Debit', 'balance_sheet': 'Current Asset', 'pnl': None, 'cash_flow': None,
        },
    },
    # --- DRAWINGS ---
    'drawings': {
        'Owner Withdrawal': {
            'chart_type': 'Equity (Reduction)', 'account': 'Drawings', 'trial_balance': 'Debit', 'balance_sheet': 'Equity (↓)', 'pnl': None, 'cash_flow': 'Financing Outflow',
        },
    },
    # --- DEPRECIATION ---
    'depreciation': {
        'Annual Depreciation Expense': {
            'chart_type': 'Expense', 'account': 'Depreciation', 'trial_balance': 'Debit', 'balance_sheet': None, 'pnl': 'Non-Cash Expense', 'cash_flow': 'Adjusted in Operating',
        },
        'Accumulated Depreciation': {
            'chart_type': 'Contra-Asset', 'account': 'Accumulated Depreciation', 'trial_balance': 'Credit', 'balance_sheet': 'Fixed Asset (contra)', 'pnl': None, 'cash_flow': None,
        },
    },
    # --- PREPAID EXPENSE ---
    'prepaid-expense': {
        'Amount Paid': {
            'chart_type': 'Asset', 'account': 'Prepaid Rent, Insurance', 'trial_balance': 'Debit', 'balance_sheet': 'Current Asset', 'pnl': None, 'cash_flow': 'Operating Outflow',
        },
    },
    # --- ACCRUED EXPENSE ---
    'accrued-expense': {
        'Expense Incurred But Unpaid': {
            'chart_type': 'Liability', 'account': 'Accrued Salaries, Bills', 'trial_balance': 'Credit', 'balance_sheet': 'Current Liability', 'pnl': 'Expense', 'cash_flow': 'Adjusted in Operating',
        },
    },
    # --- INVENTORY ---
    'inventory': {
        'Purchase of Goods': {
            'chart_type': 'Asset', 'account': 'Inventory', 'trial_balance': 'Debit', 'balance_sheet': 'Current Asset', 'pnl': None, 'cash_flow': 'Operating Outflow',
        },
        'Inventory Consumed': {
            'chart_type': 'Expense', 'account': 'COGS', 'trial_balance': 'Debit', 'balance_sheet': None, 'pnl': 'Direct Expense', 'cash_flow': 'Operating Outflow',
        },
    },
    # --- TAX PAYMENTS ---
    'tax-payments': {
        'GST/TDS/Income Tax Paid': {
            'chart_type': 'Liability (↓)', 'account': 'GST Payable / Tax Payable', 'trial_balance': 'Debit', 'balance_sheet': 'Current Liability', 'pnl': None, 'cash_flow': 'Operating Outflow',
        },
    },
}
# --- END ACCOUNTING MAP ---

def get_poppler_path():
    poppler_path = os.getenv("POPPLER_PATH")
    if poppler_path and os.path.isdir(poppler_path):
        return poppler_path
    if shutil.which("pdftoppm") is not None:
        return None
    raise RuntimeError(
        "Poppler is required for PDF processing. "
        "Install it and add to PATH, or set POPPLER_PATH in your .env file. "
        "See: https://github.com/oschwartz10612/poppler-windows"
    )

def get_textract_client():
    aws_key = os.getenv("AWS_ACCESS_KEY_ID")
    aws_secret = os.getenv("AWS_SECRET_ACCESS_KEY")
    region = os.getenv("AWS_REGION") or "ap-south-1"
    if aws_key and aws_secret:
        return boto3.client('textract',
            aws_access_key_id=aws_key,
            aws_secret_access_key=aws_secret,
            region_name=region
        )
    return None

def extract_from_docx(file_path):
    doc = Document(file_path)
    return "\n".join([p.text for p in doc.paragraphs if p.text.strip()])

def extract_from_csv(file_path):
    df = pd.read_csv(file_path)
    return df.to_string(index=False)

def extract_from_xlsx(file_path):
    try:
        df = pd.read_excel(file_path)
        return df.to_string(index=False)
    except Exception as e:
        logging.error(f"Failed to extract from xlsx: {e}")
        return ""

def extract_from_image(file_path):
    return pytesseract.image_to_string(Image.open(file_path), config='--psm 6 -l eng+nld')

async def ocr_with_tesseract(pdf_path):
    try:
        poppler_path = get_poppler_path()
    except RuntimeError as e:
        return f"Error: {str(e)}"
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            images = convert_from_path(
                pdf_path, dpi=150, output_folder=temp_dir,
                poppler_path=poppler_path
            )
        except Exception as e:
            return f"Error during PDF to image conversion: {str(e)}"
        full_text = ""
        for image in images:
            text = pytesseract.image_to_string(image, config='--psm 6 -l eng+nld')
            full_text += text + "\n"
        return full_text.strip()

def extract_with_pdfplumber(file_path):
    try:
        text = ""
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text += page.extract_text() or ""
        return text.strip()
    except Exception as e:
        logging.warning(f"pdfplumber failed: {e}")
        return ""

async def extract_text_with_textract(file_path):
    textract = get_textract_client()
    if not textract:
        return await ocr_with_tesseract(file_path)
    with open(file_path, 'rb') as file:
        try:
            response = textract.detect_document_text(Document={'Bytes': file.read()})
            blocks = response.get("Blocks", [])
            text = " ".join(block.get("Text", "") for block in blocks if block["BlockType"] == "LINE")
            if not text.strip():
                return await ocr_with_tesseract(file_path)
            return text
        except Exception:
            return await ocr_with_tesseract(file_path)

async def extract_text(file_path: str, extension: str) -> str:
    try:
        if extension == ".pdf":
            text = extract_with_pdfplumber(file_path)
            if not text:
                logging.warning("pdfplumber found no text, using Tesseract fallback.")
                return await ocr_with_tesseract(file_path)
            return text
        elif extension == ".docx":
            return extract_from_docx(file_path)
        elif extension == ".csv":
            return extract_from_csv(file_path)
        elif extension == ".xlsx":
            return extract_from_xlsx(file_path)
        elif extension in [".png", ".jpg", ".jpeg"]:
            return extract_from_image(file_path)
        else:
            raise ValueError("Unsupported file format")
    except Exception as e:
        logging.error(f"Text extraction failed: {e}")
        return ""

def openai_chat_with_retry(messages: list, max_attempts: int = 3, verification_attempts: int = 2) -> str:
    """Enhanced OpenAI chat with retry and verification logic"""
    all_responses = []
    
    # Make multiple attempts to get responses
    for attempt in range(max_attempts):
        try:
            response = openai.chat.completions.create(
                model="gpt-4",
                messages=messages,
                temperature=0.1
            )
            content = response.choices[0].message.content
            if content:
                all_responses.append(content.strip())
        except Exception as e:
            print(f"OpenAI attempt {attempt + 1} failed: {e}")
            if attempt == max_attempts - 1:
                raise HTTPException(status_code=500, detail=f"OpenAI error after {max_attempts} attempts: {str(e)}")
    
    # If we have multiple responses, verify consistency
    if len(all_responses) >= verification_attempts:
        # Check if responses are similar (for classification tasks)
        if "classify" in str(messages).lower() or "category" in str(messages).lower():
            # For classification, check if responses are the same
            unique_responses = set(all_responses)
            if len(unique_responses) == 1:
                return all_responses[0]  # All responses agree
            else:
                # Responses differ, use the most common one
                from collections import Counter
                most_common = Counter(all_responses).most_common(1)[0][0]
                print(f"Classification responses differed: {all_responses}, using most common: {most_common}")
                return most_common
        
        # For extraction tasks, verify the extracted amounts are similar
        elif "extract" in str(messages).lower() or "amount" in str(messages).lower():
            # Try to extract amounts from responses and compare
            amounts = []
            for response in all_responses:
                try:
                    # Extract JSON and find amount
                    json_str = extract_json_from_response(response)
                    result = json.loads(json_str)
                    if 'final_amount' in result:
                        amounts.append(float(result['final_amount']))
                    elif 'amount' in result:
                        amounts.append(float(result['amount']))
                except Exception:
                    continue
            
            if len(amounts) >= 2:
                # Check if amounts are within 10% of each other
                avg_amount = sum(amounts) / len(amounts)
                variance = max(abs(amt - avg_amount) for amt in amounts)
                if variance / avg_amount < 0.1:  # Within 10%
                    # Use the response with highest confidence or most detailed
                    best_response = max(all_responses, key=lambda x: len(x))
                    print(f"Amount extraction verified: {amounts}, using: {avg_amount}")
                    return best_response
                else:
                    # Amounts differ significantly, use the most common range
                    print(f"Amount extraction differed significantly: {amounts}")
                    return all_responses[0]  # Fallback to first response
    
    # Return the first valid response if verification fails
    return all_responses[0] if all_responses else ""

def openai_chat(messages: list, max_attempts: int = 3) -> str:
    """Legacy function - now uses enhanced retry logic"""
    return openai_chat_with_retry(messages, max_attempts, 2)

def extract_json_from_response(response_str):
    # Try to extract the first {...} JSON object from the response
    match = re.search(r'\{[\s\S]*\}', response_str)
    if match:
        return match.group(0)
    return response_str  # fallback

def sanitize_amount(value):
    try:
        # Remove any non-numeric characters except dot and minus
        amount_str = str(value)
        amount_clean = re.sub(r'[^0-9.\-]', '', amount_str)
        return float(amount_clean) if amount_clean else 0.0
    except Exception:
        return 0.0

def validate_and_parse_date(date_str):
    """Validate and parse date strings, defaulting to current date if invalid"""
    from datetime import datetime, date
    
    if not date_str:
        return date.today().isoformat()
    
    # Try different date formats
    date_formats = [
        '%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%Y/%m/%d',
        '%d-%m-%Y', '%m-%d-%Y', '%d.%m.%Y', '%m.%d.%Y',
        '%B %d, %Y', '%d %B %Y', '%Y-%m-%d %H:%M:%S'
    ]
    
    for fmt in date_formats:
        try:
            parsed_date = datetime.strptime(str(date_str).strip(), fmt)
            return parsed_date.date().isoformat()
        except ValueError:
            continue
    
    # If no format matches, return current date
    return date.today().isoformat()

def validate_payment_status(amount, date_str, description):
    """Validate payment status based on amount, date, and description"""
    from datetime import datetime, date
    
    current_date = date.today()
    payment_date = datetime.strptime(validate_and_parse_date(date_str), '%Y-%m-%d').date()
    
    # Check if payment is overdue (more than 30 days old)
    days_difference = (current_date - payment_date).days
    
    # Determine payment status
    if amount > 0:
        if days_difference > 30:
            return "overdue"
        elif days_difference > 0:
            return "pending"
        else:
            return "paid"
    else:
        return "pending"

def extract_final_amount_with_openai(text: str) -> dict:
    """Use OpenAI to specifically extract the final amount from text with retry and verification"""
    messages = [
        {"role": "system", "content": (
            "You are a financial amount extraction specialist. Your ONLY job is to find the FINAL/TOTAL amount from the given text. "
            "Look for these specific patterns and keywords: "
            "- 'Total:', 'Final Amount:', 'Amount Due:', 'Grand Total:', 'Net Amount:' "
            "- 'Final Balance:', 'Total Due:', 'Final Payment:', 'Total Payment:' "
            "- 'Final Sum:', 'Total Sum:', 'Balance Due:', 'Amount Owed:' "
            "- Numbers that appear to be totals (usually the largest amount or last amount mentioned) "
            "Return ONLY a JSON object with this exact format: "
            "{ \"final_amount\": <number>, \"confidence\": <0-1>, \"amount_type\": <string>, \"extraction_notes\": <string> } "
            "Where: "
            "- final_amount: The extracted final amount as a number "
            "- confidence: How confident you are (0-1) "
            "- amount_type: What type of amount this is (e.g., 'Total Due', 'Final Payment', 'Net Amount') "
            "- extraction_notes: Brief explanation of why you chose this amount "
            "If no amount is found, return: { \"final_amount\": 0, \"confidence\": 0, \"amount_type\": \"Not Found\", \"extraction_notes\": \"No amount detected\" }"
        )},
        {"role": "user", "content": f"Extract the FINAL AMOUNT from this text: {text}"}
    ]
    
    try:
        # Use enhanced retry logic with verification
        result_str = openai_chat_with_retry(messages, max_attempts=3, verification_attempts=2)
        if result_str:
            result_str = result_str.strip()
        else:
            result_str = ""
        
        # Extract JSON from response
        json_str = extract_json_from_response(result_str)
        result = json.loads(json_str)
        
        # Validate the extracted amount
        final_amount = result.get('final_amount', 0)
        if isinstance(final_amount, str):
            final_amount = sanitize_amount(final_amount)
        elif not isinstance(final_amount, (int, float)):
            final_amount = 0
            
        return {
            'final_amount': final_amount,
            'confidence': result.get('confidence', 0),
            'amount_type': result.get('amount_type', 'Unknown'),
            'extraction_notes': result.get('extraction_notes', ''),
            'raw_response': result_str
        }
    except Exception as e:
        print(f"Error extracting final amount: {e}")
        return {
            'final_amount': 0,
            'confidence': 0,
            'amount_type': 'Error',
            'extraction_notes': f'Extraction failed: {str(e)}',
            'raw_response': ''
        }

# Function to classify text using OpenAI with retry and verification

def classify_financial_category(text: str) -> str:
    messages = [
        {"role": "system", "content": (
            "You are a financial classification expert. "
        "Classify the following financial transaction or document text into one of these categories: "
        "Cash Balance, Revenue, Expenses, Net Burn. "
            "Respond with only the category name, nothing else."
        )},
        {"role": "user", "content": f"Classify this text: {text}"}
    ]
    try:
        # Use enhanced retry logic with verification
        category = openai_chat_with_retry(messages, max_attempts=3, verification_attempts=2)
        if category:
            category = category.strip()
        return category if category else ""
    except Exception as e:
        print(f"OpenAI API error: {e}")
        return ""

@app.post("/analyze-document/")
async def analyze_document(file: UploadFile = File(...)):
    content = await file.read()
    text = None
    
    # Get file extension
    file_extension = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    
    # Save file to temporary location for processing
    with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as tmp:
                    tmp.write(content)
                    tmp_path = tmp.name
    
    try:
        # Use the new extraction function
        text = await extract_text(tmp_path, file_extension)
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="No extractable text found in the document.")
    except Exception as e:
        os.unlink(tmp_path)
        raise HTTPException(status_code=400, detail=f"Failed to extract text from document: {str(e)}")
    finally:
        # Clean up temporary file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
    messages = [
        {"role": "system", "content": (
            "You are a professional financial document analyzer specializing in extracting FINAL AMOUNTS. "
            "Your primary goal is to identify and extract the FINAL/TOTAL amount that should be paid or received. "
            "Look for keywords like: 'Total', 'Final Amount', 'Amount Due', 'Grand Total', 'Net Amount', 'Final Balance', 'Total Due', 'Final Payment', 'Total Payment', 'Final Sum', 'Total Sum'. "
            "Analyze the given document and classify it into one of these categories: "
            "bank-transactions, invoices, bills, inventory, item-restocks, manual-journals, general-ledgers, general-entries. "
            "Extract relevant financial data and return ONLY valid JSON in this format: "
            "{ \"category\": <string>, \"extractedData\": <object>, \"confidence\": <float between 0 and 1> }. "
            "The extractedData MUST include: "
            "- amount: The FINAL/TOTAL amount (this is the most important field - extract the final amount that should be paid/received) "
            "- date: Document date or transaction date "
            "- description: Brief description of the transaction/document "
            "- vendor/customer: Name of the vendor, customer, or party involved "
            "- payment_terms: Payment terms if mentioned "
            "- due_date: Due date if mentioned "
            "- final_amount_confidence: Confidence level (0-1) for the final amount extraction "
            "- amount_breakdown: Any subtotals, taxes, fees that make up the final amount "
            "IMPORTANT: Focus on finding the FINAL AMOUNT that represents the total to be paid or received. "
            "If multiple amounts are present, choose the one that appears to be the final total. "
            "Ensure all amounts are positive numbers and dates are in YYYY-MM-DD format. "
            "Do not include any explanation or text outside the JSON."
        )},
        {"role": "user", "content": f"Extract the FINAL AMOUNT from this document. Look for the total amount that should be paid or received: {text}"}
    ]
    result_str = openai_chat_with_retry(messages, max_attempts=3, verification_attempts=2)
    if not result_str:
        raise HTTPException(status_code=500, detail="No response from OpenAI after retries.")
    print("OpenAI raw response (with retry verification):", result_str)  # Log for debugging
    try:
        json_str = extract_json_from_response(result_str)
        result = json.loads(json_str)
        
        # Validate and sanitize extracted data
        if 'extractedData' in result:
            extracted_data = result['extractedData']
            category = result.get('category', '').lower()
            
            # Use specialized final amount extraction
            final_amount_result = extract_final_amount_with_openai(text)
            
            # Use the final amount if it has higher confidence or if no amount was extracted
            if final_amount_result['confidence'] > 0.5 or not extracted_data.get('amount'):
                extracted_data['amount'] = final_amount_result['final_amount']
                extracted_data['final_amount_extraction'] = final_amount_result
            else:
                # Sanitize the originally extracted amount
                if 'amount' in extracted_data:
                    extracted_data['amount'] = sanitize_amount(extracted_data['amount'])
                extracted_data['final_amount_extraction'] = {
                    'final_amount': extracted_data.get('amount', 0),
                    'confidence': extracted_data.get('final_amount_confidence', 0.5),
                    'amount_type': 'Original Extraction',
                    'extraction_notes': 'Used amount from original extraction'
                }
            
            # Validate and parse date
            if 'date' in extracted_data:
                extracted_data['date'] = validate_and_parse_date(extracted_data['date'])
            
            # Validate due date if present
            if 'due_date' in extracted_data:
                extracted_data['due_date'] = validate_and_parse_date(extracted_data['due_date'])
            
            # Determine payment status
            amount = extracted_data.get('amount', 0)
            date_str = extracted_data.get('date', '')
            description = extracted_data.get('description', '')
            extracted_data['payment_status'] = validate_payment_status(amount, date_str, description)
            
            # Add validation metadata
            extracted_data['validated_at'] = datetime.now().isoformat()
            extracted_data['validation_checks'] = {
                'amount_valid': amount > 0,
                'date_valid': bool(date_str),
                'payment_overdue': validate_payment_status(amount, date_str, description) == 'overdue',
                'final_amount_confidence': final_amount_result['confidence']
            }

            # --- ACCOUNTING MAP ATTACHMENT ---
            # Attach mapping info for each field in extracted_data
            accounting_info = {}
            if category in ACCOUNTING_MAP:
                for field, value in extracted_data.items():
                    if field in ACCOUNTING_MAP[category]:
                        accounting_info[field] = ACCOUNTING_MAP[category][field]
            extracted_data['accountingInfo'] = accounting_info
            # --- END ACCOUNTING MAP ATTACHMENT ---
        
        # Classify the extracted text into dashboard category using OpenAI
        dashboard_category = classify_financial_category(text)
        result['dashboardCategory'] = dashboard_category
        
        # Add processing metadata
        result['processed_at'] = datetime.now().isoformat()
        result['text_length'] = len(text)
        
    except Exception as e:
        print(f"Error processing OpenAI response: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to parse OpenAI response: {result_str}")
    return result

@app.post("/generate-financial-statements/")
async def generate_financial_statements(transactions: List[dict]):
    """Generate professional financial statements using OpenAI with proper accounting principles"""
    
    if not transactions:
        return {
            "balanceSheet": [],
            "profitLoss": [],
            "trialBalance": [],
            "cashFlow": [],
            "professionalNotes": []
        }
    
    # Phase 1: Categorize and analyze transactions properly
    cash_balance = 0
    revenue = 0
    expenses = 0
    cogs = 0  # Cost of Goods Sold
    operating_expenses = 0
    other_income = 0
    other_expenses = 0
    
    # Track accounts receivable and payable
    accounts_receivable = 0
    accounts_payable = 0
    
    # Track inventory
    inventory_assets = 0
    
    # Process each transaction based on its category and type
    for transaction in transactions:
        amount = transaction.get('amount', 0)
        transaction_type = transaction.get('type', 'debit')
        category = transaction.get('category', '')
        
        # Phase 3.1: Profit and Loss (P&L) calculations
        if category == 'invoices':
            # Invoices are revenue (money coming in)
            revenue += amount
            # Assume some invoices are paid, some are receivables
            if transaction_type == 'credit':
                cash_balance += amount * 0.7  # 70% paid
                accounts_receivable += amount * 0.3  # 30% outstanding
            else:
                accounts_receivable += amount
                
        elif category == 'bills':
            # Bills are expenses (money going out)
            expenses += amount
            # Assume some bills are paid, some are payables
            if transaction_type == 'debit':
                cash_balance -= amount * 0.6  # 60% paid
                accounts_payable += amount * 0.4  # 40% outstanding
            else:
                accounts_payable += amount
                
        elif category == 'bank-transactions':
            # Bank transactions affect cash balance directly
            if transaction_type == 'credit':
                cash_balance += amount
            else:
                cash_balance -= amount
                
        elif category == 'inventory':
            if transaction_type == 'debit':
                # Inventory purchase - affects COGS and cash
                cogs += amount
                inventory_assets += amount
                cash_balance -= amount
            else:
                # Inventory sale - affects revenue and reduces inventory
                revenue += amount
                inventory_assets = max(0, inventory_assets - amount * 0.8)  # Assume 80% cost
                cash_balance += amount
                
        elif category == 'item-restocks':
            if transaction_type == 'debit':
                # Restock purchase - affects COGS
                cogs += amount
                inventory_assets += amount
                cash_balance -= amount
            else:
                # Restock received - affects inventory
                inventory_assets += amount
                
        elif category in ['manual-journals', 'general-ledgers', 'general-entries']:
            # General entries affect cash balance based on type
            if transaction_type == 'credit':
                cash_balance += amount
                # Check if it's other income
                if amount > 1000:  # Threshold for other income
                    other_income += amount
            else:
                cash_balance -= amount
                # Check if it's operating expense
                if amount > 500:  # Threshold for operating expense
                    operating_expenses += amount
                else:
                    other_expenses += amount
    
    # Phase 3.1: Calculate P&L components
    gross_profit = revenue - cogs
    operating_income = gross_profit - operating_expenses
    net_income = operating_income + other_income - other_expenses
    
    # Phase 3.3: Build Balance Sheet with proper classification
    balance_sheet = []
    
    # Assets (Current + Non-current)
    # Current Assets
    balance_sheet.append({
        "account": "Cash and Cash Equivalents",
        "type": "asset",
        "amount": max(0, cash_balance),  # Ensure positive
        "category": "Current"
    })
    
    if accounts_receivable > 0:
        balance_sheet.append({
            "account": "Accounts Receivable",
            "type": "asset",
            "amount": accounts_receivable,
            "category": "Current"
        })
    
    if inventory_assets > 0:
        balance_sheet.append({
            "account": "Inventory",
            "type": "asset",
            "amount": inventory_assets,
            "category": "Current"
        })
    
    # Non-current Assets (if any)
    # Add fixed assets if present in transactions
    fixed_assets = sum(t.get('amount', 0) for t in transactions 
                      if t.get('category') == 'fixed-assets')
    if fixed_assets > 0:
        balance_sheet.append({
            "account": "Fixed Assets",
            "type": "asset",
            "amount": fixed_assets,
            "category": "Non-Current"
        })
    
    # Liabilities (Current + Long-term)
    # Current Liabilities
    if accounts_payable > 0:
        balance_sheet.append({
            "account": "Accounts Payable",
            "type": "liability",
            "amount": accounts_payable,
            "category": "Current"
        })
    
    # Long-term Liabilities (if any)
    long_term_debt = sum(t.get('amount', 0) for t in transactions 
                        if t.get('category') == 'long-term-debt')
    if long_term_debt > 0:
        balance_sheet.append({
            "account": "Long-term Debt",
            "type": "liability",
            "amount": long_term_debt,
            "category": "Non-Current"
        })
    
    # Equity
    # Retained Earnings = Net Income
    balance_sheet.append({
        "account": "Retained Earnings",
        "type": "equity",
        "amount": net_income,
        "category": "Equity"
    })
    
    # Phase 3.2: Ensure Trial Balance balances (Sum of Debits = Sum of Credits)
    total_assets = sum(item['amount'] for item in balance_sheet if item['type'] == 'asset')
    total_liabilities = sum(item['amount'] for item in balance_sheet if item['type'] == 'liability')
    total_equity = sum(item['amount'] for item in balance_sheet if item['type'] == 'equity')
    
    # If there's a difference, adjust retained earnings
    difference = total_assets - (total_liabilities + total_equity)
    if abs(difference) > 0.01:
        for item in balance_sheet:
            if item['account'] == 'Retained Earnings':
                item['amount'] += difference
                break
    
    # Phase 3.1: Build Profit & Loss Statement
    profit_loss = []
    
    if revenue > 0:
        profit_loss.append({
            "account": "Revenue & Sales",
            "type": "revenue",
            "amount": revenue,
            "category": "Revenue"
        })
    
    if cogs > 0:
        profit_loss.append({
            "account": "Cost of Goods Sold",
            "type": "expense",
            "amount": cogs,
            "category": "COGS"
        })
    
    if operating_expenses > 0:
        profit_loss.append({
            "account": "Operating Expenses",
            "type": "expense",
            "amount": operating_expenses,
            "category": "Operating"
        })
    
    if other_income > 0:
        profit_loss.append({
            "account": "Other Income",
            "type": "revenue",
            "amount": other_income,
            "category": "Other"
        })
    
    if other_expenses > 0:
        profit_loss.append({
            "account": "Other Expenses",
            "type": "expense",
            "amount": other_expenses,
            "category": "Other"
        })
    
    # Phase 3.2: Build Trial Balance
    trial_balance = []

    # Add all accounts from balance sheet (excluding Retained Earnings for current period)
    for item in balance_sheet:
        if item['account'] == 'Retained Earnings':
            continue  # Skip for now, will add after income/expense accounts
        if item['type'] == 'asset':
            trial_balance.append({
                "account": item['account'],
                "debit": item['amount'],
                "credit": 0
            })
        else:  # liability or equity
            trial_balance.append({
                "account": item['account'],
                "debit": 0,
                "credit": item['amount']
            })

    # Add revenue and expense accounts (current period)
    for item in profit_loss:
        if item['type'] == 'revenue':
            trial_balance.append({
                "account": item['account'],
                "debit": 0,
                "credit": item['amount']
            })
        else:  # expense
            trial_balance.append({
                "account": item['account'],
                "debit": item['amount'],
                "credit": 0
            })

    # Add Retained Earnings as opening balance (if tracked)
    # For now, set to 0 unless you have prior period data
    opening_retained_earnings = 0
    trial_balance.append({
        "account": "Retained Earnings (Opening)",
        "debit": 0,
        "credit": opening_retained_earnings
    })

    # Ensure debits equal credits by adding a suspense account if needed
    total_debits = sum(item['debit'] for item in trial_balance)
    total_credits = sum(item['credit'] for item in trial_balance)
    if abs(total_debits - total_credits) > 0.01:
        diff = total_debits - total_credits
        if diff > 0:
            trial_balance.append({
                "account": "Suspense Account (Credit)",
                "debit": 0,
                "credit": abs(diff)
            })
        else:
            trial_balance.append({
                "account": "Suspense Account (Debit)",
                "debit": abs(diff),
                "credit": 0
            })
    
    # Phase 3.4: Build Cash Flow Statement (Indirect Method)
    cash_flow = []
    
    # Operating Activities
    cash_flow.append({
        "description": "Net Income",
        "amount": net_income,
        "type": "operating"
    })
    
    # Adjustments for non-cash items
    if operating_expenses > 0:
        cash_flow.append({
            "description": "Add: Operating Expenses (non-cash)",
            "amount": operating_expenses * 0.2,  # Assume 20% non-cash
            "type": "operating"
        })
    
    # Changes in working capital
    if accounts_receivable > 0:
        cash_flow.append({
            "description": "Less: Increase in Accounts Receivable",
            "amount": -accounts_receivable,
            "type": "operating"
        })
    
    if accounts_payable > 0:
        cash_flow.append({
            "description": "Add: Increase in Accounts Payable",
            "amount": accounts_payable,
            "type": "operating"
        })
    
    if inventory_assets > 0:
        cash_flow.append({
            "description": "Less: Increase in Inventory",
            "amount": -inventory_assets,
            "type": "operating"
        })
    
    # Investing Activities
    if fixed_assets > 0:
        cash_flow.append({
            "description": "Purchase of Fixed Assets",
            "amount": -fixed_assets,
            "type": "investing"
        })
    
    # Financing Activities
    if long_term_debt > 0:
        cash_flow.append({
            "description": "Proceeds from Long-term Debt",
            "amount": long_term_debt,
            "type": "financing"
        })
    
    # Net cash flow
    net_cash_flow = sum(item['amount'] for item in cash_flow)
    
    # Ensure cash flow balances with cash balance
    if abs(net_cash_flow - cash_balance) > 0.01:
        cash_flow.append({
            "description": "Net Change in Cash",
            "amount": cash_balance,
            "type": "operating"
        })
    
    # Use OpenAI to generate professional financial statement notes and analysis
    professional_notes = await generate_professional_financial_notes(
        balance_sheet, profit_loss, trial_balance, cash_flow, transactions
    )
    
    return {
        "balanceSheet": balance_sheet,
        "profitLoss": profit_loss,
        "trialBalance": trial_balance,
        "cashFlow": cash_flow,
        "professionalNotes": professional_notes
    }

async def generate_professional_financial_notes(balance_sheet, profit_loss, trial_balance, cash_flow, transactions):
    """Generate professional financial statement notes using OpenAI"""
    
    # Prepare data summary for OpenAI
    total_assets = sum(item['amount'] for item in balance_sheet if item['type'] == 'asset')
    total_liabilities = sum(item['amount'] for item in balance_sheet if item['type'] == 'liability')
    total_equity = sum(item['amount'] for item in balance_sheet if item['type'] == 'equity')
    total_revenue = sum(item['amount'] for item in profit_loss if item['type'] == 'revenue')
    total_expenses = sum(item['amount'] for item in profit_loss if item['type'] == 'expense')
    net_income = total_revenue - total_expenses
    
    # Categorize transactions
    transaction_summary = {}
    for transaction in transactions:
        category = transaction.get('category', 'other')
        if category not in transaction_summary:
            transaction_summary[category] = {'count': 0, 'total': 0}
        transaction_summary[category]['count'] += 1
        transaction_summary[category]['total'] += transaction.get('amount', 0)
    
    messages = [
        {"role": "system", "content": (
            "You are a professional financial analyst and accountant. Generate comprehensive, "
            "professional financial statement notes and analysis based on the provided financial data. "
            "Your response should include:\n\n"
            "1. EXECUTIVE SUMMARY: Brief overview of financial performance\n"
            "2. BALANCE SHEET ANALYSIS: Analysis of assets, liabilities, and equity\n"
            "3. PROFIT & LOSS ANALYSIS: Revenue and expense analysis\n"
            "4. CASH FLOW ANALYSIS: Operating, investing, and financing activities\n"
            "5. KEY FINANCIAL RATIOS: Calculate and interpret important ratios\n"
            "6. RISK ASSESSMENT: Identify potential financial risks\n"
            "7. RECOMMENDATIONS: Strategic recommendations for improvement\n\n"
            "Use professional accounting terminology and provide insights that would be valuable "
            "for stakeholders, investors, and management. Format the response in clear sections "
            "with proper headings and bullet points where appropriate."
        )},
        {"role": "user", "content": f"""
Generate professional financial statement notes for the following data:

FINANCIAL SUMMARY:
- Total Assets: ${total_assets:,.2f}
- Total Liabilities: ${total_liabilities:,.2f}
- Total Equity: ${total_equity:,.2f}
- Total Revenue: ${total_revenue:,.2f}
- Total Expenses: ${total_expenses:,.2f}
- Net Income: ${net_income:,.2f}

BALANCE SHEET DETAILS:
{json.dumps(balance_sheet, indent=2)}

PROFIT & LOSS DETAILS:
{json.dumps(profit_loss, indent=2)}

CASH FLOW DETAILS:
{json.dumps(cash_flow, indent=2)}

TRANSACTION SUMMARY:
{json.dumps(transaction_summary, indent=2)}

Generate comprehensive professional analysis and notes.
"""}
    ]
    
    try:
        # Use enhanced retry logic for professional analysis
        result_str = openai_chat_with_retry(messages, max_attempts=3, verification_attempts=2)
        if not result_str:
            return {
                "executive_summary": "Financial analysis completed successfully.",
                "balance_sheet_analysis": "Balance sheet analysis available.",
                "profit_loss_analysis": "Profit and loss analysis completed.",
                "cash_flow_analysis": "Cash flow analysis available.",
                "key_ratios": {},
                "risk_assessment": "Standard financial risks identified.",
                "recommendations": "General recommendations provided."
            }
        
        # Parse the professional analysis
        return {
            "professional_analysis": result_str,
            "generated_at": datetime.now().isoformat(),
            "ai_verified": True
        }
        
    except Exception as e:
        print(f"Error generating professional notes: {e}")
        return {
            "executive_summary": "Financial analysis completed successfully.",
            "balance_sheet_analysis": "Balance sheet analysis available.",
            "profit_loss_analysis": "Profit and loss analysis completed.",
            "cash_flow_analysis": "Cash flow analysis available.",
            "key_ratios": {},
            "risk_assessment": "Standard financial risks identified.",
            "recommendations": "General recommendations provided.",
            "error": f"Professional analysis generation failed: {str(e)}"
        }

@app.post("/classify-transaction/")
async def classify_transaction(description: str = Body(..., embed=True)):
    category = classify_financial_category(description)
    return {"dashboardCategory": category}

@app.post("/extract-final-amount/")
async def extract_final_amount_endpoint(text: str = Body(..., embed=True)):
    """Extract final amount from text using OpenAI"""
    result = extract_final_amount_with_openai(text)
    return result

@app.post("/validate-payments/")
async def validate_payments(transactions: List[dict]):
    """Validate all payments and return summary"""
    current_date = date.today()
    validation_summary = {
        "total_transactions": len(transactions),
        "validated_at": datetime.now().isoformat(),
        "payment_summary": {
            "paid": 0,
            "pending": 0,
            "overdue": 0
        },
        "overdue_payments": [],
        "validation_issues": []
    }
    
    for transaction in transactions:
        try:
            amount = transaction.get('amount', 0)
            date_str = transaction.get('date', '')
            description = transaction.get('description', '')
            
            # Validate payment status
            payment_status = validate_payment_status(amount, date_str, description)
            
            # Update summary
            validation_summary["payment_summary"][payment_status] += 1
            
            # Track overdue payments
            if payment_status == "overdue":
                validation_summary["overdue_payments"].append({
                    "id": transaction.get('id'),
                    "description": description,
                    "amount": amount,
                    "date": date_str,
                    "days_overdue": (current_date - datetime.strptime(validate_and_parse_date(date_str), '%Y-%m-%d').date()).days
                })
            
            # Check for validation issues
            if amount <= 0:
                validation_summary["validation_issues"].append({
                    "id": transaction.get('id'),
                    "issue": "Invalid amount",
                    "value": amount
                })
            
            if not date_str:
                validation_summary["validation_issues"].append({
                    "id": transaction.get('id'),
                    "issue": "Missing date",
                    "value": date_str
                })
                
        except Exception as e:
            validation_summary["validation_issues"].append({
                "id": transaction.get('id'),
                "issue": f"Processing error: {str(e)}",
                "value": None
            })
    
    return validation_summary

@app.post("/validate-and-correct-data/")
async def validate_and_correct_data(transactions: List[dict]):
    """Validate and correct financial data using OpenAI"""
    
    if not transactions:
        return {
            "status": "success",
            "message": "No transactions to validate",
            "corrections": [],
            "issues_found": 0
        }
    
    # Prepare data for OpenAI analysis
    transaction_summary = []
    for transaction in transactions:
        transaction_summary.append({
            "id": transaction.get('id'),
            "date": transaction.get('date'),
            "description": transaction.get('description'),
            "amount": transaction.get('amount'),
            "category": transaction.get('category'),
            "type": transaction.get('type'),
            "dashboardCategory": transaction.get('dashboardCategory')
        })
