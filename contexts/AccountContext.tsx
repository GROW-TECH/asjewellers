import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

export interface InvestmentAccount {
  id: string;
  user_id: string;
  account_number: string;
  account_name: string;
  aadhar_number: string | null;
  pan_number: string | null;
  kyc_verified: boolean;
  kyc_verified_at: string | null;
  is_primary: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

interface AccountContextType {
  accounts: InvestmentAccount[];
  selectedAccount: InvestmentAccount | null;
  activeAccount: InvestmentAccount | null;
  setSelectedAccount: (account: InvestmentAccount) => void;
  loadAccounts: () => Promise<void>;
  createAccount: (accountName: string) => Promise<{ success: boolean; error?: string }>;
  loading: boolean;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export function AccountProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [selectedAccount, setSelectedAccountState] = useState<InvestmentAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadAccounts();
    } else {
      setAccounts([]);
      setSelectedAccountState(null);
      setLoading(false);
    }
  }, [user]);

  const loadAccounts = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('investment_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setAccounts(data);

        const savedAccountId = await getSavedAccountId();
        const accountToSelect = savedAccountId
          ? data.find(acc => acc.id === savedAccountId)
          : data.find(acc => acc.is_primary) || data[0];

        setSelectedAccountState(accountToSelect || null);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const setSelectedAccount = async (account: InvestmentAccount) => {
    setSelectedAccountState(account);
    await saveAccountId(account.id);
  };

  const createAccount = async (accountName: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'User not logged in' };

    try {
      const accountNumber = await generateAccountNumber(user.id);

      const { data, error } = await supabase
        .from('investment_accounts')
        .insert({
          user_id: user.id,
          account_number: accountNumber,
          account_name: accountName,
          is_primary: false,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes('Maximum 10')) {
          return { success: false, error: 'You can only create up to 10 investment accounts' };
        }
        throw error;
      }

      await loadAccounts();
      return { success: true };
    } catch (error: any) {
      console.error('Error creating account:', error);
      return { success: false, error: error.message || 'Failed to create account' };
    }
  };

  const generateAccountNumber = async (userId: string): Promise<string> => {
    const { data, error } = await supabase.rpc('generate_account_number', {
      user_id_param: userId,
    });

    if (error) throw error;
    return data;
  };

  const saveAccountId = async (accountId: string) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('selectedAccountId', accountId);
      }
    } catch (error) {
      console.error('Error saving account ID:', error);
    }
  };

  const getSavedAccountId = async (): Promise<string | null> => {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('selectedAccountId');
      }
    } catch (error) {
      console.error('Error getting saved account ID:', error);
    }
    return null;
  };

  return (
    <AccountContext.Provider
      value={{
        accounts,
        selectedAccount,
        activeAccount: selectedAccount,
        setSelectedAccount,
        loadAccounts,
        createAccount,
        loading,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
}
