import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAppContext } from '../context/AppContext';
import { Upload, FileText, Brain, CheckCircle, AlertCircle, Clock, Trash2 } from 'lucide-react';
// REMOVE: import { OpenAIService } from '../services/openai';

export const DocumentsAI: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleDeleteDocument = (documentId: string) => {
    // Remove document from state
    dispatch({
      type: 'REMOVE_DOCUMENT',
      payload: documentId
    });
    
    // Also remove associated transaction if it exists
    const transactionId = documentId + '_transaction';
    dispatch({
      type: 'REMOVE_TRANSACTION',
      payload: transactionId
    });
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsAnalyzing(true);
    
    for (const file of acceptedFiles) {
      const fileId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      
      // Add document to state
      dispatch({
        type: 'ADD_DOCUMENT',
        payload: {
          id: fileId,
          name: file.name,
          type: file.type,
          uploadDate: new Date().toISOString(),
          status: 'processing'
        }
      });

      try {
        // Prepare form data
        const formData = new FormData();
        formData.append('file', file);

        // Call backend
        const response = await fetch('http://localhost:8000/analyze-document/', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error('Backend error');
        const analysis = await response.json();
        
        // Update document with analysis results
        dispatch({
          type: 'UPDATE_DOCUMENT',
          payload: {
            id: fileId,
            name: file.name,
            type: file.type,
            uploadDate: new Date().toISOString(),
            status: 'completed',
            category: analysis.category,
            analysis: analysis,
            dashboardCategory: analysis.dashboardCategory // Store OpenAI category
          }
        });

                  // Add to appropriate transaction category with enhanced validation
          if (analysis.extractedData) {
            let amount = 0;
            let type: 'credit' | 'debit' = 'debit';
            let date = analysis.extractedData.date || analysis.extractedData.invoiceDate || new Date().toISOString().split('T')[0];
            let description = analysis.extractedData.description || file.name;
            let dashboardCategory = analysis.dashboardCategory || '';
            let dueDate = analysis.extractedData.due_date || '';
            let vendor = analysis.extractedData.vendor || analysis.extractedData.customer || '';

            // Handle different categories and field names
            if (analysis.category === 'bank-transactions') {
              if (analysis.extractedData.incoming) {
                amount = parseFloat(String(analysis.extractedData.incoming).replace(/[^0-9.-]/g, '')) || 0;
                type = 'credit';
              } else if (analysis.extractedData.outgoing) {
                amount = parseFloat(String(analysis.extractedData.outgoing).replace(/[^0-9.-]/g, '')) || 0;
                type = 'debit';
              } else if (analysis.extractedData.amount) {
                amount = parseFloat(String(analysis.extractedData.amount).replace(/[^0-9.-]/g, '')) || 0;
                type = amount >= 0 ? 'credit' : 'debit';
              }
            } else {
              // For invoices, bills, etc.
              if (analysis.extractedData.amount) {
                amount = parseFloat(String(analysis.extractedData.amount).replace(/[^0-9.-]/g, '')) || 0;
                type = amount >= 0 ? 'credit' : 'debit';
              }
            }

            dispatch({
              type: 'ADD_TRANSACTION',
              payload: {
                id: fileId + '_transaction',
                date,
                description,
                amount,
                category: analysis.category,
                type,
                dashboardCategory, // Store OpenAI category in transaction
                dueDate,
                vendor,
                validatedAt: analysis.extractedData.validated_at,
                validationChecks: analysis.extractedData.validation_checks
              }
            });
          }

      } catch (error) {
        console.error('Document analysis failed:', error);
        dispatch({
          type: 'UPDATE_DOCUMENT',
          payload: {
            id: fileId,
            name: file.name,
            type: file.type,
            uploadDate: new Date().toISOString(),
            status: 'failed'
          }
        });
      }
    }
    
    setIsAnalyzing(false);
  }, [dispatch]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg']
    },
    multiple: true
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      'bank-transactions': 'bg-blue-100 text-blue-800',
      'invoices': 'bg-green-100 text-green-800',
      'bills': 'bg-red-100 text-red-800',
      'inventory': 'bg-purple-100 text-purple-800',
      'item-restocks': 'bg-yellow-100 text-yellow-800',
      'manual-journals': 'bg-indigo-100 text-indigo-800',
      'general-ledgers': 'bg-pink-100 text-pink-800',
      'general-entries': 'bg-gray-100 text-gray-800'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Documents AI</h1>
        <div className="flex items-center space-x-2">
          <Brain className="w-8 h-8 text-blue-600" />
          <span className="text-sm text-gray-600">AI-Powered Document Analysis</span>
        </div>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-200 ${
            isDragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900 mb-2">
            {isDragActive ? 'Drop your documents here' : 'Upload financial documents'}
          </p>
          <p className="text-gray-600">
            Drag & drop files or click to browse. Supports PDF, DOCX, TXT, CSV, Excel, and image files (PNG, JPG).
          </p>
          {isAnalyzing && (
            <div className="mt-4 flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-blue-600 font-medium">Analyzing documents with AI verification...</span>
            </div>
          )}
        </div>
        
        {/* Verification Status */}
        <div className="mt-4 bg-green-50 rounded-lg p-3 border border-green-200">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-800">AI Verification Active</span>
          </div>
          <p className="text-xs text-green-700 mt-1">
            All AI analyses use retry logic and verification to ensure consistent, reliable results.
          </p>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Uploaded Documents</h3>
        {state.documents.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No documents uploaded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Document</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Category</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Confidence</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Upload Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {state.documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <FileText className="w-5 h-5 text-gray-500" />
                        <span className="font-medium text-gray-900">{doc.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(doc.status)}
                        <span className="capitalize text-sm font-medium">{doc.status}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {doc.category && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(doc.category)}`}>
                          {doc.category.replace('-', ' ')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {doc.analysis?.extractedData?.amount && (
                        <div>
                          <span className="text-sm font-medium text-gray-900">
                            ${parseFloat(doc.analysis.extractedData.amount).toLocaleString()}
                          </span>
                          {doc.analysis.extractedData.final_amount_extraction && (
                            <div className="text-xs text-gray-500 mt-1">
                              {doc.analysis.extractedData.final_amount_extraction.amount_type} 
                              ({Math.round(doc.analysis.extractedData.final_amount_extraction.confidence * 100)}%)
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {doc.analysis?.confidence && (
                        <span className="text-sm text-gray-600">
                          {Math.round(doc.analysis.confidence * 100)}%
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(doc.uploadDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                        title="Delete document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};