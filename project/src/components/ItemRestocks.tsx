import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { RotateCcw, Plus, Search, AlertCircle, CheckCircle } from 'lucide-react';

export const ItemRestocks: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
        category: 'item-restocks',
        type: form.type as 'credit' | 'debit',
        dashboardCategory,
      }
    });
    setShowModal(false);
    setForm({ date: '', description: '', amount: '', type: 'debit' });
  };

  const restocks = state.transactions.filter(
    transaction => transaction.category === 'item-restocks'
  );

  const filteredRestocks = restocks.filter(restock => {
    const matchesSearch = restock.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const totalRestockValue = restocks.reduce((sum, restock) => sum + restock.amount, 0);
  const pendingRestocks = restocks.filter(restock => restock.type === 'debit').length;
  const completedRestocks = restocks.filter(restock => restock.type === 'credit').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Item Restocks</h1>
        <div className="flex items-center space-x-2">
          <RotateCcw className="w-8 h-8 text-yellow-600" />
          <span className="text-sm text-gray-600">Restock Management</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-600">Total Restock Value</p>
              <p className="text-2xl font-bold text-yellow-900">${totalRestockValue.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-yellow-600 rounded-lg">
              <RotateCcw className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Pending Restocks</p>
              <p className="text-2xl font-bold text-blue-900">{pendingRestocks}</p>
            </div>
            <div className="p-3 bg-blue-600 rounded-lg">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Completed Restocks</p>
              <p className="text-2xl font-bold text-green-900">{completedRestocks}</p>
            </div>
            <div className="p-3 bg-green-600 rounded-lg">
              <CheckCircle className="w-6 h-6 text-white" />
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
                placeholder="Search restocks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <button
            className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            onClick={() => setShowModal(true)}
          >
            <Plus className="w-5 h-5" />
            <span>Schedule Restock</span>
          </button>
        </div>
      </div>
      {/* Modal for scheduling restock */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-xl p-8 shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Schedule Restock</h2>
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
                <option value="debit">Pending</option>
                <option value="credit">Completed</option>
              </select>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  className="px-4 py-2 bg-gray-200 rounded-lg"
                  onClick={() => setShowModal(false)}
                  disabled={isClassifying}
                >Cancel</button>
                <button
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg"
                  onClick={handleCreate}
                  disabled={isClassifying}
                >{isClassifying ? 'Classifying...' : 'Add'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restocks Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Restock Orders</h3>
        </div>
        
        {filteredRestocks.length === 0 ? (
          <div className="p-8 text-center">
            <RotateCcw className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No restock orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Order #</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Date</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Item</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Supplier</th>
                  <th className="text-right py-3 px-6 font-medium text-gray-900">Quantity</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Status</th>
                  <th className="text-right py-3 px-6 font-medium text-gray-900">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {filteredRestocks.map((restock) => (
                  <tr key={restock.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 text-sm font-medium text-gray-900">
                      #{restock.id.slice(-6)}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-900">
                      {new Date(restock.date).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-900">{restock.description}</td>
                    <td className="py-4 px-6 text-sm text-gray-900">Supplier Co.</td>
                    <td className="py-4 px-6 text-right text-sm text-gray-900">
                      {Math.floor(Math.random() * 100) + 1}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        restock.type === 'credit' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {restock.type === 'credit' ? 'Completed' : 'Pending'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-semibold text-gray-900">
                      ${restock.amount.toLocaleString()}
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