/*
  # MLM Gold Saving App Schema

  ## Overview
  This migration creates the complete database schema for an MLM gold saving application where users save Rs. 1500/month for 11 months and receive a bonus in the 12th month, with a 10-level referral commission system.

  ## New Tables

  ### 1. profiles
  - `id` (uuid, primary key) - Links to auth.users
  - `phone_number` (text, unique) - User's phone number for login
  - `full_name` (text) - User's full name
  - `referral_code` (text, unique) - User's unique referral code
  - `referred_by` (uuid, foreign key) - ID of the user who referred this user
  - `status` (text) - Account status: active, inactive, suspended
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. plans
  - `id` (uuid, primary key) - Plan identifier
  - `name` (text) - Plan name
  - `monthly_amount` (decimal) - Monthly payment amount (Rs. 1500)
  - `duration_months` (integer) - Plan duration in months (12)
  - `payment_months` (integer) - Number of months user pays (11)
  - `bonus_percentage` (decimal) - Company bonus percentage
  - `status` (text) - Plan status: active, inactive
  - `created_at` (timestamptz) - Plan creation timestamp

  ### 3. user_subscriptions
  - `id` (uuid, primary key) - Subscription identifier
  - `user_id` (uuid, foreign key) - User who subscribed
  - `plan_id` (uuid, foreign key) - Subscribed plan
  - `start_date` (date) - Subscription start date
  - `end_date` (date) - Subscription end date
  - `status` (text) - Subscription status: active, completed, cancelled
  - `total_paid` (decimal) - Total amount paid by user
  - `bonus_amount` (decimal) - Bonus amount from company
  - `final_amount` (decimal) - Total amount including bonus
  - `created_at` (timestamptz) - Subscription creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 4. wallets
  - `id` (uuid, primary key) - Wallet identifier
  - `user_id` (uuid, unique, foreign key) - Wallet owner
  - `saving_balance` (decimal) - Balance from monthly savings
  - `referral_balance` (decimal) - Balance from referral commissions
  - `total_balance` (decimal) - Total wallet balance
  - `updated_at` (timestamptz) - Last update timestamp

  ### 5. payments
  - `id` (uuid, primary key) - Payment identifier
  - `user_id` (uuid, foreign key) - User who made payment
  - `subscription_id` (uuid, foreign key) - Related subscription
  - `amount` (decimal) - Payment amount
  - `payment_type` (text) - Type: monthly_payment, bonus, referral_commission
  - `month_number` (integer) - Month number in the plan (1-12)
  - `status` (text) - Payment status: pending, completed, failed
  - `payment_date` (timestamptz) - Payment date
  - `created_at` (timestamptz) - Record creation timestamp

  ### 6. referral_tree
  - `id` (uuid, primary key) - Tree node identifier
  - `user_id` (uuid, foreign key) - User in the tree
  - `referred_user_id` (uuid, foreign key) - User who was referred
  - `level` (integer) - Referral level (1-10)
  - `created_at` (timestamptz) - Relationship creation timestamp

  ### 7. referral_commissions
  - `id` (uuid, primary key) - Commission identifier
  - `user_id` (uuid, foreign key) - User receiving commission
  - `from_user_id` (uuid, foreign key) - User who made the payment
  - `payment_id` (uuid, foreign key) - Payment that triggered commission
  - `level` (integer) - Referral level (1-10)
  - `percentage` (decimal) - Commission percentage
  - `amount` (decimal) - Commission amount
  - `status` (text) - Status: pending, paid
  - `created_at` (timestamptz) - Commission creation timestamp

  ### 8. referral_levels_config
  - `level` (integer, primary key) - Level number (1-10)
  - `percentage` (decimal) - Commission percentage for this level
  - `amount` (decimal) - Fixed commission amount for Rs. 1500 payment

  ## Security
  - Enable RLS on all tables
  - Users can only view and update their own data
  - Referral tree is read-only for users
  - Commission configuration is read-only for all users
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number text UNIQUE NOT NULL,
  full_name text NOT NULL,
  referral_code text UNIQUE NOT NULL,
  referred_by uuid REFERENCES profiles(id),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create plans table
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  monthly_amount decimal(10,2) NOT NULL DEFAULT 1500.00,
  duration_months integer NOT NULL DEFAULT 12,
  payment_months integer NOT NULL DEFAULT 11,
  bonus_percentage decimal(5,2) NOT NULL DEFAULT 9.09,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now()
);

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  total_paid decimal(10,2) DEFAULT 0,
  bonus_amount decimal(10,2) DEFAULT 0,
  final_amount decimal(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  saving_balance decimal(10,2) DEFAULT 0,
  referral_balance decimal(10,2) DEFAULT 0,
  total_balance decimal(10,2) DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,
  amount decimal(10,2) NOT NULL,
  payment_type text NOT NULL CHECK (payment_type IN ('monthly_payment', 'bonus', 'referral_commission')),
  month_number integer NOT NULL CHECK (month_number >= 1 AND month_number <= 12),
  status text DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  payment_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create referral_tree table
CREATE TABLE IF NOT EXISTS referral_tree (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  level integer NOT NULL CHECK (level >= 1 AND level <= 10),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, referred_user_id)
);

-- Create referral_commissions table
CREATE TABLE IF NOT EXISTS referral_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  level integer NOT NULL CHECK (level >= 1 AND level <= 10),
  percentage decimal(5,2) NOT NULL,
  amount decimal(10,2) NOT NULL,
  status text DEFAULT 'paid' CHECK (status IN ('pending', 'paid')),
  created_at timestamptz DEFAULT now()
);

-- Create referral_levels_config table
CREATE TABLE IF NOT EXISTS referral_levels_config (
  level integer PRIMARY KEY CHECK (level >= 1 AND level <= 10),
  percentage decimal(5,2) NOT NULL,
  amount decimal(10,2) NOT NULL
);

-- Insert referral commission configuration based on the provided structure
INSERT INTO referral_levels_config (level, percentage, amount) VALUES
  (1, 10.00, 150.00),
  (2, 3.00, 45.00),
  (3, 2.00, 30.00),
  (4, 1.50, 22.50),
  (5, 0.75, 11.25),
  (6, 0.75, 11.25),
  (7, 0.50, 7.50),
  (8, 0.50, 7.50),
  (9, 0.50, 7.50),
  (10, 0.50, 7.50)
ON CONFLICT (level) DO NOTHING;

-- Insert default plan
INSERT INTO plans (name, monthly_amount, duration_months, payment_months, bonus_percentage, status)
VALUES ('Gold Saving Plan', 1500.00, 12, 11, 9.09, 'active')
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON profiles(referred_by);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_referral_tree_user_id ON referral_tree(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_tree_referred_user_id ON referral_tree(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_user_id ON referral_commissions(user_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_tree ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_levels_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RLS Policies for plans
CREATE POLICY "Anyone can view active plans"
  ON plans FOR SELECT
  TO authenticated
  USING (status = 'active');

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON user_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own subscriptions"
  ON user_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON user_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for wallets
CREATE POLICY "Users can view own wallet"
  ON wallets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own wallet"
  ON wallets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet"
  ON wallets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for payments
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for referral_tree
CREATE POLICY "Users can view own referral tree"
  ON referral_tree FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = referred_user_id);

-- RLS Policies for referral_commissions
CREATE POLICY "Users can view own commissions"
  ON referral_commissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for referral_levels_config
CREATE POLICY "Anyone can view referral levels"
  ON referral_levels_config FOR SELECT
  TO authenticated
  USING (true);

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS text AS $$
DECLARE
  code text;
  exists boolean;
BEGIN
  LOOP
    code := 'REF' || LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0');
    SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = code) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to build referral tree when a new user joins
CREATE OR REPLACE FUNCTION build_referral_tree()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id uuid;
  current_level integer;
BEGIN
  IF NEW.referred_by IS NOT NULL THEN
    current_user_id := NEW.referred_by;
    current_level := 1;
    
    -- Insert direct referrer at level 1
    INSERT INTO referral_tree (user_id, referred_user_id, level)
    VALUES (current_user_id, NEW.id, current_level);
    
    -- Build up the tree for levels 2-10
    WHILE current_level < 10 LOOP
      SELECT referred_by INTO current_user_id
      FROM profiles
      WHERE id = current_user_id AND referred_by IS NOT NULL;
      
      EXIT WHEN current_user_id IS NULL;
      
      current_level := current_level + 1;
      
      INSERT INTO referral_tree (user_id, referred_user_id, level)
      VALUES (current_user_id, NEW.id, current_level);
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically build referral tree
CREATE TRIGGER build_referral_tree_trigger
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION build_referral_tree();

-- Function to calculate and distribute referral commissions
CREATE OR REPLACE FUNCTION distribute_referral_commissions()
RETURNS TRIGGER AS $$
DECLARE
  referrer_record RECORD;
  commission_config RECORD;
  commission_amount decimal(10,2);
BEGIN
  -- Only process monthly payments
  IF NEW.payment_type = 'monthly_payment' AND NEW.status = 'completed' THEN
    -- Find all users in the referral tree for this user
    FOR referrer_record IN
      SELECT user_id, level
      FROM referral_tree
      WHERE referred_user_id = NEW.user_id
      ORDER BY level ASC
    LOOP
      -- Get commission configuration for this level
      SELECT percentage, amount INTO commission_config
      FROM referral_levels_config
      WHERE level = referrer_record.level;
      
      IF FOUND THEN
        commission_amount := commission_config.amount;
        
        -- Create commission record
        INSERT INTO referral_commissions (
          user_id, from_user_id, payment_id, level, percentage, amount, status
        ) VALUES (
          referrer_record.user_id, NEW.user_id, NEW.id, 
          referrer_record.level, commission_config.percentage, commission_amount, 'paid'
        );
        
        -- Update referrer's wallet
        UPDATE wallets
        SET 
          referral_balance = referral_balance + commission_amount,
          total_balance = total_balance + commission_amount,
          updated_at = now()
        WHERE user_id = referrer_record.user_id;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically distribute commissions on payment
CREATE TRIGGER distribute_commissions_trigger
AFTER INSERT ON payments
FOR EACH ROW
EXECUTE FUNCTION distribute_referral_commissions();

-- Function to update wallet on payment
CREATE OR REPLACE FUNCTION update_wallet_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_type = 'monthly_payment' AND NEW.status = 'completed' THEN
    UPDATE wallets
    SET 
      saving_balance = saving_balance + NEW.amount,
      total_balance = total_balance + NEW.amount,
      updated_at = now()
    WHERE user_id = NEW.user_id;
  ELSIF NEW.payment_type = 'bonus' AND NEW.status = 'completed' THEN
    UPDATE wallets
    SET 
      saving_balance = saving_balance + NEW.amount,
      total_balance = total_balance + NEW.amount,
      updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update wallet on payment
CREATE TRIGGER update_wallet_trigger
AFTER INSERT ON payments
FOR EACH ROW
EXECUTE FUNCTION update_wallet_on_payment();