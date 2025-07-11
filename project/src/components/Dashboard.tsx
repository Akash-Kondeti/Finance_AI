import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { format } from 'date-fns';

export const Dashboard: React.FC = () => {
  const { state } = useAppContext();

  // Compute metrics from transactions using proper accounting principles
  const cashBalance = state.transactions.reduce((sum, t) => {
    if (t.category === 'bank-transactions') {
      return sum + (t.type === 'credit' ? t.amount : -t.amount);
    } else if (t.category === 'invoices') {
      // Invoices: 70% paid, 30% receivables
      return sum + (t.type === 'credit' ? t.amount * 0.7 : 0);
    } else if (t.category === 'bills') {
      // Bills: 60% paid, 40% payables
      return sum - (t.type === 'debit' ? t.amount * 0.6 : 0);
    } else if (t.category === 'inventory') {
      if (t.type === 'debit') {
        // Inventory purchase
        return sum - t.amount;
      } else {
        // Inventory sale
        return sum + t.amount;
      }
    } else if (t.category === 'item-restocks') {
      if (t.type === 'debit') {
        // Restock purchase
        return sum - t.amount;
      }
      // Restock received doesn't affect cash
      return sum;
    } else if (t.category === 'manual-journals' || t.category === 'general-ledgers' || 
               t.category === 'general-entries') {
      return sum + (t.type === 'credit' ? t.amount : -t.amount);
    }
    return sum;
  }, 0);
  
  const revenue = state.transactions
    .filter(t => t.category === 'invoices')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const expenses = state.transactions
    .filter(t => t.category === 'bills')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const netBurn = expenses - revenue; // Net burn is expenses minus revenue

  // Calculate accounts receivable and payable
  const accountsReceivable = state.transactions
    .filter(t => t.category === 'invoices')
    .reduce((sum, t) => {
      if (t.type === 'credit') {
        return sum + t.amount * 0.3; // 30% outstanding
      }
      return sum + t.amount; // All outstanding if debit
    }, 0);

  const accountsPayable = state.transactions
    .filter(t => t.category === 'bills')
    .reduce((sum, t) => {
      if (t.type === 'debit') {
        return sum + t.amount * 0.4; // 40% outstanding
      }
      return sum + t.amount; // All outstanding if credit
    }, 0);

  // Compute cash flow data from transactions
  const monthlyData: Record<string, { inflow: number; outflow: number }> = {};
  state.transactions.forEach(t => {
    const month = format(new Date(t.date), 'yyyy-MM');
    if (!monthlyData[month]) {
      monthlyData[month] = { inflow: 0, outflow: 0 };
    }
    
    // Categorize based on transaction category
    if (t.category === 'invoices') {
      // Invoices are inflow (revenue)
      monthlyData[month].inflow += t.amount;
    } else if (t.category === 'bills') {
      // Bills are outflow (expenses)
      monthlyData[month].outflow += t.amount;
    } else if (t.category === 'bank-transactions') {
      // Bank transactions based on type
      if (t.type === 'credit') {
        monthlyData[month].inflow += t.amount;
      } else {
        monthlyData[month].outflow += t.amount;
      }
    } else if (t.category === 'inventory' || t.category === 'item-restocks' || 
               t.category === 'manual-journals' || t.category === 'general-ledgers' || 
               t.category === 'general-entries') {
      // Other transactions based on type
      if (t.type === 'credit') {
        monthlyData[month].inflow += t.amount;
      } else {
        monthlyData[month].outflow += t.amount;
      }
    }
  });
  const cashFlowChartData = Object.entries(monthlyData).map(([month, { inflow, outflow }]) => ({
    month,
    inflow,
    outflow,
    net: inflow - outflow,
  }));

  const MetricCard: React.FC<{
    title: string;
    value: number;
    icon: React.ElementType;
    color: string;
    trend?: number;
  }> = ({ title, value, icon: Icon, color, trend }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ${value.toLocaleString()}
          </p>
          {trend && (
            <div className={`flex items-center mt-2 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend > 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              <span className="text-sm font-medium">{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  // Use cashFlowChartData for both charts

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Financial Dashboard</h1>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            Last updated: {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Cash Balance"
          value={Math.max(0, cashBalance)}
          icon={DollarSign}
          color="bg-blue-600"
        />
        <MetricCard
          title="Revenue"
          value={revenue}
          icon={TrendingUp}
          color="bg-green-600"
        />
        <MetricCard
          title="Expenses"
          value={expenses}
          icon={TrendingDown}
          color="bg-red-600"
        />
        <MetricCard
          title="Net Burn"
          value={netBurn}
          icon={Activity}
          color="bg-purple-600"
        />
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MetricCard
          title="Accounts Receivable"
          value={accountsReceivable}
          icon={TrendingUp}
          color="bg-indigo-600"
        />
        <MetricCard
          title="Accounts Payable"
          value={accountsPayable}
          icon={TrendingDown}
          color="bg-yellow-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash Flow Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cash Flow Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cashFlowChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="inflow" stroke="#10b981" strokeWidth={3} name="Inflow" />
              <Line type="monotone" dataKey="outflow" stroke="#ef4444" strokeWidth={3} name="Outflow" />
              <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={3} name="Net" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Comparison */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Comparison</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cashFlowChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend />
              <Bar dataKey="inflow" fill="#10b981" name="Inflow" radius={[4, 4, 0, 0]} />
              <Bar dataKey="outflow" fill="#ef4444" name="Outflow" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {state.transactions.slice(0, 5).map((transaction, index) => (
            <div key={transaction.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className={`w-2 h-2 rounded-full ${transaction.type === 'credit' ? 'bg-green-500' : 'bg-red-500'}`} />
                <div>
                  <p className="font-medium text-gray-900">{transaction.description}</p>
                  <p className="text-sm text-gray-500">{transaction.date}</p>
                </div>
              </div>
              <div className={`font-semibold ${transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                {transaction.type === 'credit' ? '+' : '-'}${transaction.amount.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};