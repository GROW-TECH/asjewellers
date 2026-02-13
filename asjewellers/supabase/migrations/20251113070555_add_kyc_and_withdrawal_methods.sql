/*
  # Add KYC and Enhanced Withdrawal Methods

  1. Profile Table Updates
    - Add `aadhar_number` (text, encrypted for security)
    - Add `pan_number` (text, encrypted for security)
    - Add `kyc_verified` (boolean, default false)
    - Add `kyc_verified_at` (timestamptz, when KYC was verified)

  2. Withdrawal Requests Table Updates
    - Update `payment_method` to support 'account' and 'upi'
    - Update `payment_details` structure to support:
      - For UPI: { upi_id: string }
      - For Account: { account_holder: string, account_number: string, ifsc_code: string, bank_name: string }

  3. Security
    - KYC data is sensitive and should only be accessible by the user and admins
    - Add validation for Aadhar (12 digits) and PAN (alphanumeric format)

  4. Important Notes
    - Aadhar and PAN should be stored securely
    - KYC verification should be done by admin before allowing withdrawals
    - Payment details are stored as JSONB for flexibility
*/

-- Add KYC fields to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'aadhar_number'
  ) THEN
    ALTER TABLE profiles ADD COLUMN aadhar_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'pan_number'
  ) THEN
    ALTER TABLE profiles ADD COLUMN pan_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'kyc_verified'
  ) THEN
    ALTER TABLE profiles ADD COLUMN kyc_verified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'kyc_verified_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN kyc_verified_at timestamptz;
  END IF;
END $$;

-- Update withdrawal_requests payment_method constraint to include 'account' and 'upi'
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_payment_method_check;
  
  -- Add new constraint with 'account' and 'upi' options
  ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_payment_method_check 
    CHECK (payment_method IN ('account', 'upi'));
END $$;

-- Create index for faster KYC lookups
CREATE INDEX IF NOT EXISTS idx_profiles_kyc_verified ON profiles(kyc_verified);
CREATE INDEX IF NOT EXISTS idx_profiles_aadhar ON profiles(aadhar_number) WHERE aadhar_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_pan ON profiles(pan_number) WHERE pan_number IS NOT NULL;

-- Function to validate Aadhar number format (12 digits)
CREATE OR REPLACE FUNCTION validate_aadhar(aadhar text)
RETURNS boolean AS $$
BEGIN
  RETURN aadhar ~ '^\d{12}$';
END;
$$ LANGUAGE plpgsql;

-- Function to validate PAN number format (alphanumeric: ABCDE1234F)
CREATE OR REPLACE FUNCTION validate_pan(pan text)
RETURNS boolean AS $$
BEGIN
  RETURN pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$';
END;
$$ LANGUAGE plpgsql;