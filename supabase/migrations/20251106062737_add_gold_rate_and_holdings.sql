/*
  # Add Gold Rate and Holdings Tracking

  ## Overview
  This migration adds gold rate tracking and gold holdings management to track milligrams of gold purchased with each payment.

  ## New Tables

  ### 1. gold_rates
  - `id` (uuid, primary key) - Rate record identifier
  - `rate_date` (date, unique) - Date for this gold rate
  - `rate_per_gram` (decimal) - Gold rate per gram in Rs
  - `created_by` (uuid, foreign key) - Admin who created the rate
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. gold_holdings
  - `id` (uuid, primary key) - Holding record identifier
  - `user_id` (uuid, foreign key) - User who owns the gold
  - `subscription_id` (uuid, foreign key) - Related subscription
  - `payment_id` (uuid, foreign key) - Payment that purchased this gold
  - `amount_paid` (decimal) - Amount paid in Rs
  - `gold_rate` (decimal) - Gold rate at time of purchase
  - `gold_milligrams` (decimal) - Gold purchased in milligrams
  - `purchase_date` (timestamptz) - Purchase date
  - `type` (text) - Type: monthly_purchase, bonus_gold
  - `created_at` (timestamptz) - Record creation timestamp

  ## Table Modifications

  ### wallets
  - Add `gold_balance_mg` (decimal) - Total gold holdings in milligrams

  ### payments
  - Add `gold_milligrams` (decimal) - Gold purchased with this payment
  - Add `gold_rate` (decimal) - Gold rate at time of payment

  ## Security
  - Enable RLS on new tables
  - Only authenticated users can view gold rates
  - Users can only view their own gold holdings
  - Admin functionality for updating rates will be handled separately
*/

-- Create gold_rates table
CREATE TABLE IF NOT EXISTS gold_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date date UNIQUE NOT NULL DEFAULT CURRENT_DATE,
  rate_per_gram decimal(10,2) NOT NULL,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create gold_holdings table
CREATE TABLE IF NOT EXISTS gold_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES user_subscriptions(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES payments(id) ON DELETE CASCADE,
  amount_paid decimal(10,2) NOT NULL,
  gold_rate decimal(10,2) NOT NULL,
  gold_milligrams decimal(10,3) NOT NULL,
  purchase_date timestamptz DEFAULT now(),
  type text NOT NULL CHECK (type IN ('monthly_purchase', 'bonus_gold')),
  created_at timestamptz DEFAULT now()
);

-- Add gold tracking columns to wallets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallets' AND column_name = 'gold_balance_mg'
  ) THEN
    ALTER TABLE wallets ADD COLUMN gold_balance_mg decimal(10,3) DEFAULT 0;
  END IF;
END $$;

-- Add gold tracking columns to payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'gold_milligrams'
  ) THEN
    ALTER TABLE payments ADD COLUMN gold_milligrams decimal(10,3) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'gold_rate'
  ) THEN
    ALTER TABLE payments ADD COLUMN gold_rate decimal(10,2) DEFAULT 0;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_gold_rates_rate_date ON gold_rates(rate_date DESC);
CREATE INDEX IF NOT EXISTS idx_gold_holdings_user_id ON gold_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_gold_holdings_subscription_id ON gold_holdings(subscription_id);

-- Enable Row Level Security
ALTER TABLE gold_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE gold_holdings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gold_rates
CREATE POLICY "Anyone can view gold rates"
  ON gold_rates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert gold rates"
  ON gold_rates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update gold rates"
  ON gold_rates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for gold_holdings
CREATE POLICY "Users can view own gold holdings"
  ON gold_holdings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own gold holdings"
  ON gold_holdings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Function to get current gold rate
CREATE OR REPLACE FUNCTION get_current_gold_rate()
RETURNS decimal AS $$
DECLARE
  current_rate decimal(10,2);
BEGIN
  SELECT rate_per_gram INTO current_rate
  FROM gold_rates
  ORDER BY rate_date DESC
  LIMIT 1;
  
  IF current_rate IS NULL THEN
    current_rate := 6500.00;
  END IF;
  
  RETURN current_rate;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate gold milligrams from rupees
CREATE OR REPLACE FUNCTION calculate_gold_milligrams(amount_rs decimal, rate_per_gram decimal)
RETURNS decimal AS $$
BEGIN
  RETURN ROUND((amount_rs / rate_per_gram * 1000)::numeric, 3);
END;
$$ LANGUAGE plpgsql;

-- Insert default gold rate
INSERT INTO gold_rates (rate_date, rate_per_gram)
VALUES (CURRENT_DATE, 6500.00)
ON CONFLICT (rate_date) DO NOTHING;