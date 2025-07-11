import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { BookOpen, Search, Filter, TrendingUp, TrendingDown, Plus } from 'lucide-react';

export const GeneralLedgers: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    date: '',
    description: '',
    amount: '',
    type: 'debit',
  });
  const [isClassifying, setIsClassifying] = useState(false);

  const handleCreate = async () => {
    if (!form.date || !form.description || !form.amount) return;
    setIsClassifying(true);
    let dashboardCategory = '';
    try {
      const response = await fetch('http://localhost:8000/classify-transaction/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: form.description }),
      });
      if (response.ok) {
        const data = await response.json();
        dashboardCategory = data.dashboardCategory || '';
      }
    } catch (e) {
      // fallback: leave dashboardCategory blank
    }
    setIsClassifying(false);
    dispatch({
      type: 'ADD_TRANSACTION',
      payload: {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        date: form.date,
        description: form.description,
        amount: parseFloat(form.amount),
        category: 'general-ledgers',
        type: form.type as 'credit' | 'debit',
        dashboardCategory,
      }
    });
    setShowModal(false);
    setForm({ date: '', description: '', amount: '', type: 'debit' });
  };

  const ledgers = state.transactions.filter(
    transaction => transaction.category === 'general-ledgers'
  );

  const filteredLedgers = ledgers.filter(ledger => {
    const matchesSearch = ledger.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Group transactions by account
  const accountSummary = filteredLedgers.reduce((acc, transaction) => {
    const account = 'General Account'; // In real app, this would come from transaction data
    if (!acc[account]) {
      acc[account] = { debits: 0, credits: 0, balance: 0 };
    }
    if (transaction.type === 'debit') {
      acc[account].debits += transaction.amount;
    } else {
      acc[account].credits += transaction.amount;
    }
    acc[account].balance = acc[account].credits - acc[account].debits;
    return acc;
  }, {} as Record<string, { debits: number; credits: number; balance: number }>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">General Ledgers</h1>
        <div className="flex items-center space-x-2">
          <BookOpen className="w-8 h-8 text-pink-600" />
          <span className="text-sm text-gray-600">Ledger Management</span>
        </div>
      </div>

      {/* Account Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-6 border border-pink-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-pink-600">Total Accounts</p>
              <p className="text-2xl font-bold text-pink-900">{Object.keys(accountSummary).length}</p>
            </div>
            <div className="p-3 bg-pink-600 rounded-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Total Credits</p>
              <p className="text-2xl font-bold text-green-900">
                ${Object.values(accountSummary).reduce((sum, acc) => sum + acc.credits, 0).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-green-600 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Total Debits</p>
              <p className="text-2xl font-bold text-red-900">
                ${Object.values(accountSummary).reduce((sum, acc) => sum + acc.debits, 0).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-red-600 rounded-lg">
              <TrendingDown className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search ledger entries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="all">All Accounts</option>
              <option value="assets">Assets</option>
              <option value="liabilities">Liabilities</option>
              <option value="equity">Equity</option>
              <option value="revenue">Revenue</option>
              <option value="expenses">Expenses</option>
            </select>
          </div>
          <button
            className="flex items-center space-x-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
            onClick={() => setShowModal(true)}
          >
            <Plus className="w-5 h-5" />
            <span>Add Ledger Entry</span>
          </button>
        </div>
      </div>
      {/* Modal for creating ledger entry */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-xl p-8 shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Ledger Entry</h2>
            <div className="space-y-4">
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-2"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                placeholder="Date"
              />
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description"
              />
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="Amount"
              />
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              >
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  className="px-4 py-2 bg-gray-200 rounded-lg"
                  onClick={() => setShowModal(false)}
                  disabled={isClassifying}
                >Cancel</button>
                <button
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg"
                  onClick={handleCreate}
                  disabled={isClassifying}
                >{isClassifying ? 'Classifying...' : 'Add'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Entries Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Ledger Entries</h3>
        </div>
        
        {filteredLedgers.length === 0 ? (
          <div className="p-8 text-center">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No ledger entries found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Date</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Account</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Description</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Reference</th>
                  <th className="text-right py-3 px-6 font-medium text-gray-900">Debit</th>
                  <th className="text-right py-3 px-6 font-medium text-gray-900">Credit</th>
                  <th className="text-right py-3 px-6 font-medium text-gray-900">Balance</th>
                </tr>
              </thead>
              <tbody>
                {filteredLedgers.map((ledger, index) => (
                  <tr key={ledger.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 text-sm text-gray-900">
                      {new Date(ledger.date).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-sm font-medium text-gray-900">General Account</td>
                    <td className="py-4 px-6 text-sm text-gray-900">{ledger.description}</td>
                    <td className="py-4 px-6 text-sm text-gray-500">#{ledger.id.slice(-6)}</td>
                    <td className="py-4 px-6 text-right text-sm text-gray-900">
                      {ledger.type === 'debit' ? `$${ledger.amount.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-4 px-6 text-right text-sm text-gray-900">
                      {ledger.type === 'credit' ? `$${ledger.amount.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-4 px-6 text-right font-medium text-gray-900">
                      ${(ledger.type === 'credit' ? ledger.amount : -ledger.amount).toLocaleString()}
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