/*
  # Add Earnings Tracking System

  1. Changes
    - Create trigger to track earnings in the earnings table when commissions are added
    - Update wallet total_earnings when referral commissions are created
    - Ensure proper synchronization between earnings table and wallet totals

  2. Security
    - Maintain existing RLS policies
    - No changes to permissions
*/

-- Function to track earnings when referral commission is added
CREATE OR REPLACE FUNCTION track_referral_earnings()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into earnings table
  INSERT INTO earnings (user_id, amount, type, description)
  VALUES (
    NEW.user_id,
    NEW.amount,
    'commission',
    'Level ' || NEW.level || ' referral commission'
  );

  -- Update wallet total_earnings
  UPDATE wallets
  SET 
    total_earnings = total_earnings + NEW.amount,
    updated_at = now()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tracking earnings
DROP TRIGGER IF EXISTS track_earnings_on_commission ON referral_commissions;
CREATE TRIGGER track_earnings_on_commission
AFTER INSERT ON referral_commissions
FOR EACH ROW
EXECUTE FUNCTION track_referral_earnings();

-- Function to update total_withdrawn on withdrawal completion
CREATE OR REPLACE FUNCTION update_withdrawn_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE wallets
    SET 
      total_withdrawn = total_withdrawn + NEW.amount,
      referral_balance = referral_balance - NEW.amount,
      total_balance = total_balance - NEW.amount,
      updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for withdrawal completion
DROP TRIGGER IF EXISTS update_withdrawn_on_completion ON withdrawal_requests;
CREATE TRIGGER update_withdrawn_on_completion
AFTER UPDATE ON withdrawal_requests
FOR EACH ROW
EXECUTE FUNCTION update_withdrawn_amount();
