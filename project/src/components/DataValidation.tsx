import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Shield, AlertTriangle, CheckCircle, RefreshCw, FileText, DollarSign, Calculator } from 'lucide-react';

export const DataValidation: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [showCorrections, setShowCorrections] = useState(false);

  const validateData = async () => {
    setIsValidating(true);
    try {
      const response = await fetch('http://localhost:8000/validate-and-correct-data/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.transactions),
      });
      if (!response.ok) throw new Error('Validation failed');
      const result = await response.json();
      setValidationResult(result);
    } catch (error) {
      console.error('Data validation failed:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const applyCorrections = () => {
    if (validationResult?.corrected_transactions) {
      // Replace all transactions with corrected ones
      validationResult.corrected_transactions.forEach((transaction: any) => {
        dispatch({
          type: 'UPDATE_TRANSACTION',
          payload: transaction
        });
      });
      setShowCorrections(false);
      setValidationResult(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'removed_duplicate': return <FileText className="w-4 h-4" />;
      case 'updated_amount': return <DollarSign className="w-4 h-4" />;
      case 'added_reference': return <FileText className="w-4 h-4" />;
      case 'recalculated_balance': return <Calculator className="w-4 h-4" />;
      default: return <CheckCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Data Validation</h1>
        <div className="flex items-center space-x-2">
          <Shield className="w-8 h-8 text-green-600" />
          <span className="text-sm text-gray-600">AI-Powered Data Quality</span>
        </div>
      </div>

      {/* Validation Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Data Quality Check</h3>
            <p className="text-sm text-gray-600">
              Use AI to identify and fix data quality issues including duplicates, wrong amounts, missing references, and balance errors.
            </p>
          </div>
          <button
            onClick={validateData}
            disabled={isValidating}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-5 h-5 ${isValidating ? 'animate-spin' : ''}`} />
            <span>{isValidating ? 'Validating...' : 'Validate Data'}</span>
          </button>
        </div>

        {/* AI Verification Status */}
        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-800">AI Validation Active</span>
          </div>
          <p className="text-xs text-green-700 mt-1">
            Uses OpenAI with retry logic to identify duplicates, wrong amounts, missing references, and balance errors.
          </p>
        </div>
      </div>

      {/* Validation Results */}
      {validationResult && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Validation Results</h3>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                validationResult.issues_found > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
              }`}>
                {validationResult.issues_found} issues found
              </span>
            </div>
          </div>

          {/* Summary */}
          {validationResult.validation_result?.summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="text-2xl font-bold text-blue-900">{validationResult.validation_result.summary.total_issues}</div>
                <div className="text-sm text-blue-600">Total Issues</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                <div className="text-2xl font-bold text-red-900">{validationResult.validation_result.summary.duplicates_found}</div>
                <div className="text-sm text-red-600">Duplicates</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                <div className="text-2xl font-bold text-yellow-900">{validationResult.validation_result.summary.amount_errors}</div>
                <div className="text-sm text-yellow-600">Amount Errors</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                <div className="text-2xl font-bold text-purple-900">{validationResult.validation_result.summary.missing_refs}</div>
                <div className="text-sm text-purple-600">Missing Refs</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                <div className="text-2xl font-bold text-orange-900">{validationResult.validation_result.summary.balance_errors}</div>
                <div className="text-sm text-orange-600">Balance Errors</div>
              </div>
            </div>
          )}

          {/* Issues List */}
          {validationResult.validation_result?.issues && validationResult.validation_result.issues.length > 0 && (
            <div className="mb-6">
              <h4 className="text-md font-semibold text-gray-900 mb-3">Issues Found:</h4>
              <div className="space-y-3">
                {validationResult.validation_result.issues.map((issue: any, index: number) => (
                  <div key={index} className={`p-3 rounded-lg border ${getSeverityColor(issue.severity)}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="font-medium">{issue.type.replace('_', ' ').toUpperCase()}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          issue.severity === 'high' ? 'bg-red-100 text-red-800' :
                          issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {issue.severity}
                        </span>
                      </div>
                      <span className="text-sm text-gray-600">ID: {issue.transaction_id}</span>
                    </div>
                    <p className="text-sm mt-2">{issue.description}</p>
                    {issue.suggested_correction && (
                      <div className="mt-2 text-sm">
                        <strong>Suggested Fix:</strong> {issue.suggested_correction.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Corrections Applied */}
          {validationResult.corrections && validationResult.corrections.length > 0 && (
            <div className="mb-6">
              <h4 className="text-md font-semibold text-gray-900 mb-3">Corrections Applied:</h4>
              <div className="space-y-3">
                {validationResult.corrections.map((correction: any, index: number) => (
                  <div key={index} className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-2">
                      {getActionIcon(correction.action)}
                      <span className="font-medium">{correction.action.replace('_', ' ').toUpperCase()}</span>
                    </div>
                    <p className="text-sm mt-1">{correction.description || correction.notes}</p>
                    {correction.old_amount && correction.new_amount && (
                      <p className="text-sm mt-1 text-gray-600">
                        Amount: ${correction.old_amount.toLocaleString()} → ${correction.new_amount.toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {validationResult.message}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowCorrections(!showCorrections)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {showCorrections ? 'Hide' : 'Show'} Corrected Data
              </button>
              {validationResult.corrected_transactions && (
                <button
                  onClick={applyCorrections}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Apply Corrections
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Show Corrected Transactions */}
      {showCorrections && validationResult?.corrected_transactions && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Corrected Transactions</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Description</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Type</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">Amount</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {validationResult.corrected_transactions.map((transaction: any) => (
                  <tr key={transaction.id} className="border-b border-gray-100">
                    <td className="py-3 px-4 text-sm text-gray-900">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">{transaction.description}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        transaction.type === 'credit' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {transaction.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900">
                      ${transaction.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-gray-600">
                      ${transaction.running_balance?.toLocaleString() || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}; 