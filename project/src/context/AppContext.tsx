import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { FinancialData, Document, TransactionData, FinancialStatement, CashFlowData } from '../types';

interface AppState {
  financialData: FinancialData;
  cashFlowData: CashFlowData[];
  documents: Document[];
  transactions: TransactionData[];
  financialStatements: FinancialStatement;
  loading: boolean;
  error: string | null;
}

type AppAction = 
  | { type: 'SET_FINANCIAL_DATA'; payload: FinancialData }
  | { type: 'SET_CASH_FLOW_DATA'; payload: CashFlowData[] }
  | { type: 'ADD_DOCUMENT'; payload: Document }
  | { type: 'UPDATE_DOCUMENT'; payload: Document }
  | { type: 'REMOVE_DOCUMENT'; payload: string }
  | { type: 'ADD_TRANSACTION'; payload: TransactionData }
  | { type: 'UPDATE_TRANSACTION'; payload: TransactionData }
  | { type: 'REMOVE_TRANSACTION'; payload: string }
  | { type: 'SET_FINANCIAL_STATEMENTS'; payload: FinancialStatement }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

const initialState: AppState = {
  financialData: {
    cashBalance: 0,
    revenue: 0,
    expenses: 0,
    netBurn: 0
  },
  cashFlowData: [],
  documents: [],
  transactions: [],
  financialStatements: {
    balanceSheet: [],
    profitLoss: [],
    trialBalance: [],
    cashFlow: []
  },
  loading: false,
  error: null
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_FINANCIAL_DATA':
      return { ...state, financialData: action.payload };
    case 'SET_CASH_FLOW_DATA':
      return { ...state, cashFlowData: action.payload };
    case 'ADD_DOCUMENT':
      return { ...state, documents: [...state.documents, action.payload] };
    case 'UPDATE_DOCUMENT':
      return {
        ...state,
        documents: state.documents.map(doc => 
          doc.id === action.payload.id ? action.payload : doc
        )
      };
    case 'REMOVE_DOCUMENT':
      return {
        ...state,
        documents: state.documents.filter(doc => doc.id !== action.payload)
      };
    case 'ADD_TRANSACTION':
      return { ...state, transactions: [...state.transactions, action.payload] };
    case 'UPDATE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.map(transaction => 
          transaction.id === action.payload.id ? action.payload : transaction
        )
      };
    case 'REMOVE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.filter(transaction => transaction.id !== action.payload)
      };
    case 'SET_FINANCIAL_STATEMENTS':
      return { ...state, financialStatements: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};