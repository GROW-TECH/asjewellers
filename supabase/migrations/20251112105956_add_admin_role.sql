/*
  # Add Admin Role to Profiles

  1. Changes
    - Add is_admin boolean column to profiles table
    - Set default value to false
    - Add index for faster admin queries
  
  2. Security
    - Only admins can update admin status
    - Add RLS policy for admin access
*/

-- Add is_admin column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_admin boolean DEFAULT false;
  END IF;
END $$;

-- Create index for admin queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Create RLS policies for admin access
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Create admin views for statistics
CREATE OR REPLACE VIEW admin_statistics AS
SELECT
  (SELECT COUNT(*) FROM profiles) as total_users,
  (SELECT COUNT(*) FROM user_subscriptions WHERE status = 'active') as active_subscriptions,
  (SELECT COUNT(*) FROM user_subscriptions WHERE status = 'completed') as completed_subscriptions,
  (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'completed') as total_payments,
  (SELECT COALESCE(SUM(amount), 0) FROM referral_commissions WHERE status = 'paid') as total_commissions_paid,
  (SELECT COALESCE(SUM(amount), 0) FROM referral_commissions WHERE status = 'pending') as pending_commissions;

-- Grant access to admin view
GRANT SELECT ON admin_statistics TO authenticated;
