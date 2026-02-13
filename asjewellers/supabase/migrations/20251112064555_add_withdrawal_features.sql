/*
  # Add Withdrawal Features to Wallet System

  1. New Tables
    - `withdrawal_requests`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `amount` (numeric, withdrawal amount)
      - `status` (text, pending/processing/completed/rejected)
      - `payment_method` (text, bank/upi/etc)
      - `payment_details` (jsonb, account details)
      - `transaction_id` (text, payment gateway transaction ID)
      - `requested_at` (timestamptz)
      - `processed_at` (timestamptz)
      - `notes` (text, admin notes)
    
    - `earnings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `amount` (numeric, earning amount)
      - `type` (text, referral/commission/bonus)
      - `description` (text)
      - `created_at` (timestamptz)

  2. Wallet Table Updates
    - Add `auto_withdraw_enabled` column
    - Add `auto_withdraw_threshold` column
    - Add `total_earnings` column
    - Add `total_withdrawn` column

  3. Security
    - Enable RLS on all new tables
    - Users can only view and manage their own withdrawals and earnings
*/

-- Add new columns to wallets table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallets' AND column_name = 'auto_withdraw_enabled'
  ) THEN
    ALTER TABLE wallets ADD COLUMN auto_withdraw_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallets' AND column_name = 'auto_withdraw_threshold'
  ) THEN
    ALTER TABLE wallets ADD COLUMN auto_withdraw_threshold numeric DEFAULT 1000;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallets' AND column_name = 'total_earnings'
  ) THEN
    ALTER TABLE wallets ADD COLUMN total_earnings numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallets' AND column_name = 'total_withdrawn'
  ) THEN
    ALTER TABLE wallets ADD COLUMN total_withdrawn numeric DEFAULT 0;
  END IF;
END $$;

-- Create withdrawal_requests table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  payment_method text NOT NULL,
  payment_details jsonb NOT NULL DEFAULT '{}',
  transaction_id text,
  requested_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  notes text
);

-- Create earnings table
CREATE TABLE IF NOT EXISTS earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  type text NOT NULL CHECK (type IN ('referral', 'commission', 'bonus', 'interest')),
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_earnings_user_id ON earnings(user_id);

-- Enable RLS
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;

-- Withdrawal requests policies
DROP POLICY IF EXISTS "Users can view own withdrawal requests" ON withdrawal_requests;
CREATE POLICY "Users can view own withdrawal requests"
  ON withdrawal_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create withdrawal requests" ON withdrawal_requests;
CREATE POLICY "Users can create withdrawal requests"
  ON withdrawal_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Earnings policies
DROP POLICY IF EXISTS "Users can view own earnings" ON earnings;
CREATE POLICY "Users can view own earnings"
  ON earnings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to process withdrawal
CREATE OR REPLACE FUNCTION process_withdrawal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE wallets
    SET 
      referral_balance = referral_balance - NEW.amount,
      total_withdrawn = total_withdrawn + NEW.amount,
      updated_at = now()
    WHERE user_id = NEW.user_id AND referral_balance >= NEW.amount;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient balance for withdrawal';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to process withdrawal when status changes to completed
DROP TRIGGER IF EXISTS trigger_process_withdrawal ON withdrawal_requests;
CREATE TRIGGER trigger_process_withdrawal
  AFTER INSERT OR UPDATE ON withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION process_withdrawal();
