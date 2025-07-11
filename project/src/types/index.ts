export interface FinancialData {
  cashBalance: number;
  revenue: number;
  expenses: number;
  netBurn: number;
}

export interface CashFlowData {
  month: string;
  inflow: number;
  outflow: number;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  uploadDate: string;
  status: 'processing' | 'completed' | 'failed';
  category?: DocumentCategory;
  analysis?: any;
  dashboardCategory?: string;
}

export type DocumentCategory = 
  | 'bank-transactions'
  | 'invoices' 
  | 'bills'
  | 'inventory'
  | 'item-restocks'
  | 'manual-journals'
  | 'general-ledgers'
  | 'general-entries';

export interface TransactionData {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'credit' | 'debit';
  dashboardCategory?: string;
  dueDate?: string;
  vendor?: string;
  validatedAt?: string;
  validationChecks?: {
    amount_valid: boolean;
    date_valid: boolean;
    payment_overdue: boolean;
  };
}

export interface FinancialStatement {
  balanceSheet: BalanceSheetItem[];
  profitLoss: ProfitLossItem[];
  trialBalance: TrialBalanceItem[];
  cashFlow: CashFlowItem[];
  professionalNotes?: ProfessionalNotes;
}

export interface ProfessionalNotes {
  professional_analysis?: string;
  generated_at?: string;
  ai_verified?: boolean;
  executive_summary?: string;
  balance_sheet_analysis?: string;
  profit_loss_analysis?: string;
  cash_flow_analysis?: string;
  key_ratios?: Record<string, any>;
  risk_assessment?: string;
  recommendations?: string;
  error?: string;
}

export interface BalanceSheetItem {
  account: string;
  type: 'asset' | 'liability' | 'equity';
  amount: number;
  category: string;
}

export interface ProfitLossItem {
  account: string;
  type: 'revenue' | 'expense';
  amount: number;
  category: string;
}

export interface TrialBalanceItem {
  account: string;
  debit: number;
  credit: number;
}

export interface CashFlowItem {
  description: string;
  amount: number;
  type: 'operating' | 'investing' | 'financing';
}