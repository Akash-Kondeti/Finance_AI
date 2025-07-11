import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Package, Plus, Search, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

export const Inventory: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
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
        category: 'inventory',
        type: form.type as 'credit' | 'debit',
        dashboardCategory,
      }
    });
    setShowModal(false);
    setForm({ date: '', description: '', amount: '', type: 'debit' });
  };

  const inventory = state.transactions.filter(
    transaction => transaction.category === 'inventory'
  );

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const totalInventoryValue = inventory.reduce((sum, item) => sum + item.amount, 0);
  const totalItems = inventory.length;
  const lowStockItems = Math.floor(inventory.length * 0.2);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
        <div className="flex items-center space-x-2">
          <Package className="w-8 h-8 text-purple-600" />
          <span className="text-sm text-gray-600">Inventory Management</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Total Inventory Value</p>
              <p className="text-2xl font-bold text-purple-900">${totalInventoryValue.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-purple-600 rounded-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Items</p>
              <p className="text-2xl font-bold text-blue-900">{totalItems}</p>
            </div>
            <div className="p-3 bg-blue-600 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">Low Stock Items</p>
              <p className="text-2xl font-bold text-orange-900">{lowStockItems}</p>
            </div>
            <div className="p-3 bg-orange-600 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
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
                placeholder="Search inventory..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Categories</option>
              <option value="electronics">Electronics</option>
              <option value="clothing">Clothing</option>
              <option value="books">Books</option>
              <option value="accessories">Accessories</option>
            </select>
          </div>
          <button
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            onClick={() => setShowModal(true)}
          >
            <Plus className="w-5 h-5" />
            <span>Add Item</span>
          </button>
        </div>
      </div>
      {/* Modal for creating inventory item */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-xl p-8 shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Inventory Item</h2>
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
                <option value="debit">Outflow</option>
                <option value="credit">Inflow</option>
              </select>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  className="px-4 py-2 bg-gray-200 rounded-lg"
                  onClick={() => setShowModal(false)}
                >Cancel</button>
                <button
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg"
                  onClick={handleCreate}
                >Add</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Inventory Items</h3>
        </div>
        
        {filteredInventory.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No inventory items found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Item Code</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Description</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Category</th>
                  <th className="text-right py-3 px-6 font-medium text-gray-900">Quantity</th>
                  <th className="text-right py-3 px-6 font-medium text-gray-900">Unit Price</th>
                  <th className="text-right py-3 px-6 font-medium text-gray-900">Total Value</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 text-sm font-medium text-gray-900">
                      #{item.id.slice(-6)}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-900">{item.description}</td>
                    <td className="py-4 px-6 text-sm text-gray-900">General</td>
                    <td className="py-4 px-6 text-right text-sm text-gray-900">
                      {Math.floor(Math.random() * 100) + 1}
                    </td>
                    <td className="py-4 px-6 text-right text-sm text-gray-900">
                      ${Math.floor(item.amount / 10).toFixed(2)}
                    </td>
                    <td className="py-4 px-6 text-right font-semibold text-gray-900">
                      ${item.amount.toLocaleString()}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        Math.random() > 0.3 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {Math.random() > 0.3 ? 'In Stock' : 'Low Stock'}
                      </span>
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