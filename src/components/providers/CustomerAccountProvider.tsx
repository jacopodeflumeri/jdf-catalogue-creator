'use client';

import React, { createContext, useContext } from 'react';
import type { CustomerAccountData } from '@/types';

interface CustomerAccountContextType {
  customerAccount: CustomerAccountData | null;
}

const CustomerAccountContext = createContext<CustomerAccountContextType | undefined>(undefined);

export const useCustomerAccount = () => {
  const context = useContext(CustomerAccountContext);
  if (context === undefined) {
    throw new Error('useCustomerAccount must be used within a CustomerAccountProvider');
  }
  return context;
};

interface CustomerAccountProviderProps {
  children: React.ReactNode;
  customerAccount: CustomerAccountData | null;
}

export const CustomerAccountProvider: React.FC<CustomerAccountProviderProps> = ({ 
  children, 
  customerAccount
}) => {
  const value: CustomerAccountContextType = {
    customerAccount
  };

  return (
    <CustomerAccountContext.Provider value={value}>
      {children}
    </CustomerAccountContext.Provider>
  );
};
