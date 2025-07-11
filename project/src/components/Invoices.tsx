import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Receipt, Plus, Search, Eye, Download, Send, Edit2 } from 'lucide-react';
import { jsPDF } from 'jspdf';

export const Invoices: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [form, setForm] = useState({
    date: '',
    description: '',
    amount: '',
    status: 'pending',
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
        category: 'invoices',
        type: parseFloat(form.amount) >= 0 ? 'credit' : 'debit',
        dashboardCategory,
      }
    });
    setShowModal(false);
    setForm({ date: '', description: '', amount: '', status: 'pending' });
  };

  const handleEdit = () => {
    if (!form.date || !form.description || !form.amount || !selectedInvoice) return;
    dispatch({
      type: 'UPDATE_TRANSACTION',
      payload: {
        ...selectedInvoice,
        date: form.date,
        description: form.description,
        amount: parseFloat(form.amount),
      }
    });
    setShowEditModal(false);
    setSelectedInvoice(null);
    setForm({ date: '', description: '', amount: '', status: 'pending' });
  };

  const handleDownload = (invoice: any) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Invoice Details', 10, 15);
    doc.setFontSize(12);
    let y = 30;
    Object.entries(invoice).forEach(([key, value]) => {
      doc.text(`${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`, 10, y);
      y += 10;
    });
    doc.save(`invoice-${invoice.id}.pdf`);
  };

  const handleView = (invoice: any) => {
    setSelectedInvoice(invoice);
    setShowViewModal(true);
  };

  const handleEditClick = (invoice: any) => {
    setSelectedInvoice(invoice);
    setForm({
      date: invoice.date,
      description: invoice.description,
      amount: invoice.amount.toString(),
      status: invoice.status || 'pending',
    });
    setShowEditModal(true);
  };

  const invoices = state.transactions.filter(
    transaction => transaction.category === 'invoices'
  );

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const totalInvoiceValue = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const paidInvoices = invoices.filter(invoice => invoice.type === 'credit').length;
  const pendingInvoices = invoices.filter(invoice => invoice.type === 'debit').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
        <div className="flex items-center space-x-2">
          <Receipt className="w-8 h-8 text-green-600" />
          <span className="text-sm text-gray-600">Invoice Management</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Total Invoice Value</p>
              <p className="text-2xl font-bold text-green-900">${totalInvoiceValue.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-green-600 rounded-lg">
              <Receipt className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Paid Invoices</p>
              <p className="text-2xl font-bold text-blue-900">{paidInvoices}</p>
            </div>
            <div className="p-3 bg-blue-600 rounded-lg">
              <Receipt className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-600">Pending Invoices</p>
              <p className="text-2xl font-bold text-yellow-900">{pendingInvoices}</p>
            </div>
            <div className="p-3 bg-yellow-600 rounded-lg">
              <Receipt className="w-6 h-6 text-white" />
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
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <button
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            onClick={() => setShowModal(true)}
          >
            <Plus className="w-5 h-5" />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>
      {/* Modal for creating invoice */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-xl p-8 shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Invoice</h2>
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
              <div className="flex justify-end gap-2 mt-4">
                <button className="px-4 py-2 bg-gray-200 rounded-lg" onClick={() => setShowModal(false)} disabled={isClassifying}>Cancel</button>
                <button className="px-4 py-2 bg-green-600 text-white rounded-lg" onClick={handleCreate} disabled={isClassifying}>{isClassifying ? 'Classifying...' : 'Add'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Invoices Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Invoice List</h3>
        </div>
        
        {filteredInvoices.length === 0 ? (
          <div className="p-8 text-center">
            <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No invoices found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">S. No</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Invoice #</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Date</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Customer</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Status</th>
                  <th className="text-right py-3 px-6 font-medium text-gray-900">Amount</th>
                  <th className="text-right py-3 px-6 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice, index) => (
                  <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 text-sm font-medium text-gray-900">
                      {index + 1}
                    </td>
                    <td className="py-4 px-6 text-sm font-medium text-gray-900">
                      #{invoice.id.slice(-6)}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-900">
                      {new Date(invoice.date).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-900">{invoice.description}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        invoice.type === 'credit' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {invoice.type === 'credit' ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-semibold text-gray-900">
                      ${invoice.amount.toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors" onClick={() => handleView(invoice)}>
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-green-600 transition-colors" onClick={() => handleDownload(invoice)}>
                          <Download className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-purple-600 transition-colors" onClick={() => handleEditClick(invoice)}>
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* View Modal */}
      {showViewModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-xl p-8 shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Invoice Details</h2>
            <pre className="bg-gray-100 rounded-lg p-4 text-sm overflow-x-auto mb-4">{JSON.stringify(selectedInvoice, null, 2)}</pre>
            <div className="flex justify-end">
              <button className="px-4 py-2 bg-gray-200 rounded-lg" onClick={() => setShowViewModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Modal */}
      {showEditModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-xl p-8 shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Edit Invoice</h2>
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
              <div className="flex justify-end gap-2 mt-4">
                <button className="px-4 py-2 bg-gray-200 rounded-lg" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button className="px-4 py-2 bg-green-600 text-white rounded-lg" onClick={handleEdit}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};