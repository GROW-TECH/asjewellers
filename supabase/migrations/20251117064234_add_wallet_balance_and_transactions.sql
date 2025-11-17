/*
  # Add Wallet Balance and Transactions Table

  1. Changes to investment_accounts table
    - Add `wallet_balance` column (numeric, default 0) to track account wallet balance
    
  2. New Tables
    - `transactions` - Track all wallet transactions
      - `id` (uuid, primary key)
      - `account_id` (uuid, foreign key to investment_accounts)
      - `type` (text) - Transaction type: wallet_topup, wallet_withdrawal, commission, etc.
      - `amount` (numeric) - Transaction amount
      - `status` (text) - Transaction status: pending, completed, failed
      - `description` (text) - Transaction description
      - `metadata` (jsonb) - Additional transaction data (payment gateway info, etc.)
      - `created_at` (timestamptz)
      
  3. Security
    - Enable RLS on transactions table
    - Users can only view their own account transactions
    - Admins can view all transactions
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'investment_accounts' AND column_name = 'wallet_balance'
  ) THEN
    ALTER TABLE investment_accounts ADD COLUMN wallet_balance numeric DEFAULT 0;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES investment_accounts(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('wallet_topup', 'wallet_withdrawal', 'commission', 'referral_bonus', 'plan_payment', 'bonus')),
  amount numeric NOT NULL CHECK (amount > 0),
  status text DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own account transactions" ON transactions;
CREATE POLICY "Users can view own account transactions"
  ON transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM investment_accounts
      WHERE investment_accounts.id = transactions.account_id
      AND investment_accounts.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all transactions" ON transactions;
CREATE POLICY "Admins can view all transactions"
  ON transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);