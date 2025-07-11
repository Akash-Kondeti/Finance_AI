import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  CreditCard, 
  Receipt, 
  Package, 
  RotateCcw,
  BookOpen,
  Calculator,
  PieChart,
  TrendingUp,
  Shield
} from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'documents-ai', label: 'Documents AI', icon: FileText },
  { id: 'bank-transactions', label: 'Bank Transactions', icon: CreditCard },
  { id: 'invoices', label: 'Invoices', icon: Receipt },
  { id: 'bills', label: 'Bills', icon: Receipt },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'item-restocks', label: 'Item Restocks', icon: RotateCcw },
  { id: 'manual-journals', label: 'Manual Journals', icon: BookOpen },
  { id: 'general-ledgers', label: 'General Ledgers', icon: BookOpen },
  { id: 'general-entries', label: 'General Entries', icon: Calculator },
  { id: 'financial-statements', label: 'Financial Statements', icon: TrendingUp },
  { id: 'data-validation', label: 'Data Validation', icon: Shield }
];

export const Sidebar: React.FC<SidebarProps> = ({ activeSection, onSectionChange }) => {
  return (
    <div className="w-64 bg-white shadow-lg h-screen fixed left-0 top-0 z-10">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <PieChart className="w-8 h-8 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-800">FinanceAI</h1>
        </div>
      </div>
      
      <nav className="mt-6">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`w-full flex items-center space-x-3 px-6 py-3 text-left transition-all duration-200 ${
                activeSection === item.id
                  ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};