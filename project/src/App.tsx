import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { DocumentsAI } from './components/DocumentsAI';
import { BankTransactions } from './components/BankTransactions';
import { Invoices } from './components/Invoices';
import { Bills } from './components/Bills';
import { Inventory } from './components/Inventory';
import { ItemRestocks } from './components/ItemRestocks';
import { ManualJournals } from './components/ManualJournals';
import { GeneralLedgers } from './components/GeneralLedgers';
import { GeneralEntries } from './components/GeneralEntries';
import { FinancialStatements } from './components/FinancialStatements';
import { DataValidation } from './components/DataValidation';

function App() {
  const [activeSection, setActiveSection] = useState('dashboard');

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <Dashboard />;
      case 'documents-ai':
        return <DocumentsAI />;
      case 'bank-transactions':
        return <BankTransactions />;
      case 'invoices':
        return <Invoices />;
      case 'bills':
        return <Bills />;
      case 'inventory':
        return <Inventory />;
      case 'item-restocks':
        return <ItemRestocks />;
      case 'manual-journals':
        return <ManualJournals />;
      case 'general-ledgers':
        return <GeneralLedgers />;
      case 'general-entries':
        return <GeneralEntries />;
      case 'financial-statements':
        return <FinancialStatements />;
      case 'data-validation':
        return <DataValidation />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <AppProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        <main className="ml-64 p-6">
          {renderSection()}
        </main>
      </div>
    </AppProvider>
  );
}

export default App;