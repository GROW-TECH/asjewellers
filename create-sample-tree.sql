-- Sample 10-Level Downline Tree Data
-- Run this script in Supabase SQL Editor to create test data

-- IMPORTANT: Replace 'YOUR_USER_ID_HERE' with your actual user ID
-- You can find your user ID by running: SELECT id FROM profiles WHERE phone_number = 'YOUR_PHONE';

DO $$
DECLARE
  root_user_id UUID := '6e46a016-4e3c-4f3a-a285-101f64b902f9'; -- Replace with your user ID
BEGIN

-- Level 1: 3 direct referrals
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated'),
  ('11111111-1111-1111-1111-111111111112', 'bob@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated'),
  ('11111111-1111-1111-1111-111111111113', 'carol@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, phone_number, full_name, referral_code, referred_by, status)
VALUES
  ('11111111-1111-1111-1111-111111111111', '9876543211', 'Alice Johnson', 'REF111111', root_user_id, 'active'),
  ('11111111-1111-1111-1111-111111111112', '9876543212', 'Bob Smith', 'REF111112', root_user_id, 'active'),
  ('11111111-1111-1111-1111-111111111113', '9876543213', 'Carol Davis', 'REF111113', root_user_id, 'active')
ON CONFLICT (id) DO NOTHING;

-- Level 2: 6 people (Alice: 2, Bob: 3, Carol: 1)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role)
VALUES
  ('22222222-2222-2222-2222-222222222221', 'david@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'emma@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated'),
  ('22222222-2222-2222-2222-222222222223', 'frank@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated'),
  ('22222222-2222-2222-2222-222222222224', 'grace@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated'),
  ('22222222-2222-2222-2222-222222222225', 'henry@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated'),
  ('22222222-2222-2222-2222-222222222226', 'ivy@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, phone_number, full_name, referral_code, referred_by, status)
VALUES
  ('22222222-2222-2222-2222-222222222221', '9876543221', 'David Wilson', 'REF222221', '11111111-1111-1111-1111-111111111111', 'active'),
  ('22222222-2222-2222-2222-222222222222', '9876543222', 'Emma Brown', 'REF222222', '11111111-1111-1111-1111-111111111111', 'active'),
  ('22222222-2222-2222-2222-222222222223', '9876543223', 'Frank Miller', 'REF222223', '11111111-1111-1111-1111-111111111112', 'active'),
  ('22222222-2222-2222-2222-222222222224', '9876543224', 'Grace Lee', 'REF222224', '11111111-1111-1111-1111-111111111112', 'active'),
  ('22222222-2222-2222-2222-222222222225', '9876543225', 'Henry Garcia', 'REF222225', '11111111-1111-1111-1111-111111111112', 'active'),
  ('22222222-2222-2222-2222-222222222226', '9876543226', 'Ivy Martinez', 'REF222226', '11111111-1111-1111-1111-111111111113', 'active')
ON CONFLICT (id) DO NOTHING;

-- Level 3: 5 people
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role)
VALUES
  ('33333333-3333-3333-3333-333333333331', 'jack@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated'),
  ('33333333-3333-3333-3333-333333333332', 'kelly@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'laura@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated'),
  ('33333333-3333-3333-3333-333333333334', 'mike@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated'),
  ('33333333-3333-3333-3333-333333333335', 'nancy@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, phone_number, full_name, referral_code, referred_by, status)
VALUES
  ('33333333-3333-3333-3333-333333333331', '9876543331', 'Jack Anderson', 'REF333331', '22222222-2222-2222-2222-222222222221', 'active'),
  ('33333333-3333-3333-3333-333333333332', '9876543332', 'Kelly Thomas', 'REF333332', '22222222-2222-2222-2222-222222222221', 'active'),
  ('33333333-3333-3333-3333-333333333333', '9876543333', 'Laura Jackson', 'REF333333', '22222222-2222-2222-2222-222222222222', 'active'),
  ('33333333-3333-3333-3333-333333333334', '9876543334', 'Mike White', 'REF333334', '22222222-2222-2222-2222-222222222223', 'active'),
  ('33333333-3333-3333-3333-333333333335', '9876543335', 'Nancy Harris', 'REF333335', '22222222-2222-2222-2222-222222222223', 'active')
ON CONFLICT (id) DO NOTHING;

-- Level 4: 3 people
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role)
VALUES
  ('44444444-4444-4444-4444-444444444441', 'oliver@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated'),
  ('44444444-4444-4444-4444-444444444442', 'patricia@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated'),
  ('44444444-4444-4444-4444-444444444443', 'quinn@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, phone_number, full_name, referral_code, referred_by, status)
VALUES
  ('44444444-4444-4444-4444-444444444441', '9876543441', 'Oliver Clark', 'REF444441', '33333333-3333-3333-3333-333333333331', 'active'),
  ('44444444-4444-4444-4444-444444444442', '9876543442', 'Patricia Lewis', 'REF444442', '33333333-3333-3333-3333-333333333331', 'active'),
  ('44444444-4444-4444-4444-444444444443', '9876543443', 'Quinn Robinson', 'REF444443', '33333333-3333-3333-3333-333333333332', 'active')
ON CONFLICT (id) DO NOTHING;

-- Level 5: 3 people
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role)
VALUES
  ('55555555-5555-5555-5555-555555555551', 'rachel@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated'),
  ('55555555-5555-5555-5555-555555555552', 'samuel@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated'),
  ('55555555-5555-5555-5555-555555555553', 'teresa@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, phone_number, full_name, referral_code, referred_by, status)
VALUES
  ('55555555-5555-5555-5555-555555555551', '9876543551', 'Rachel Walker', 'REF555551', '44444444-4444-4444-4444-444444444441', 'active'),
  ('55555555-5555-5555-5555-555555555552', '9876543552', 'Samuel Hall', 'REF555552', '44444444-4444-4444-4444-444444444441', 'active'),
  ('55555555-5555-5555-5555-555555555553', '9876543553', 'Teresa Young', 'REF555553', '44444444-4444-4444-4444-444444444442', 'active')
ON CONFLICT (id) DO NOTHING;

-- Level 6: 2 people
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role)
VALUES
  ('66666666-6666-6666-6666-666666666661', 'uma@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated'),
  ('66666666-6666-6666-6666-666666666662', 'victor@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, phone_number, full_name, referral_code, referred_by, status)
VALUES
  ('66666666-6666-6666-6666-666666666661', '9876543661', 'Uma Allen', 'REF666661', '55555555-5555-5555-5555-555555555551', 'active'),
  ('66666666-6666-6666-6666-666666666662', '9876543662', 'Victor King', 'REF666662', '55555555-5555-5555-5555-555555555551', 'active')
ON CONFLICT (id) DO NOTHING;

-- Level 7: 2 people
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role)
VALUES
  ('77777777-7777-7777-7777-777777777771', 'wendy@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated'),
  ('77777777-7777-7777-7777-777777777772', 'xavier@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, phone_number, full_name, referral_code, referred_by, status)
VALUES
  ('77777777-7777-7777-7777-777777777771', '9876543771', 'Wendy Wright', 'REF777771', '66666666-6666-6666-6666-666666666661', 'active'),
  ('77777777-7777-7777-7777-777777777772', '9876543772', 'Xavier Scott', 'REF777772', '66666666-6666-6666-6666-666666666661', 'active')
ON CONFLICT (id) DO NOTHING;

-- Level 8: 2 people
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role)
VALUES
  ('88888888-8888-8888-8888-888888888881', 'yara@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated'),
  ('88888888-8888-8888-8888-888888888882', 'zack@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, phone_number, full_name, referral_code, referred_by, status)
VALUES
  ('88888888-8888-8888-8888-888888888881', '9876543881', 'Yara Green', 'REF888881', '77777777-7777-7777-7777-777777777771', 'active'),
  ('88888888-8888-8888-8888-888888888882', '9876543882', 'Zack Adams', 'REF888882', '77777777-7777-7777-7777-777777777771', 'active')
ON CONFLICT (id) DO NOTHING;

-- Level 9: 2 people
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role)
VALUES
  ('99999999-9999-9999-9999-999999999991', 'aaron@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated'),
  ('99999999-9999-9999-9999-999999999992', 'bella@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, phone_number, full_name, referral_code, referred_by, status)
VALUES
  ('99999999-9999-9999-9999-999999999991', '9876543991', 'Aaron Baker', 'REF999991', '88888888-8888-8888-8888-888888888881', 'active'),
  ('99999999-9999-9999-9999-999999999992', '9876543992', 'Bella Nelson', 'REF999992', '88888888-8888-8888-8888-888888888881', 'active')
ON CONFLICT (id) DO NOTHING;

-- Level 10: 2 people
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'chloe@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'dylan@test.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{}', '{}', false, 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, phone_number, full_name, referral_code, referred_by, status)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '9876543aa1', 'Chloe Carter', 'REFaaaaaa', '99999999-9999-9999-9999-999999999991', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '9876543bb1', 'Dylan Mitchell', 'REFbbbbbb', '99999999-9999-9999-9999-999999999991', 'active')
ON CONFLICT (id) DO NOTHING;

-- Create wallets for all users
INSERT INTO wallets (user_id, saving_balance, referral_balance, total_balance, gold_balance_mg)
SELECT id, 0, 0, 0, 0 FROM profiles
ON CONFLICT (user_id) DO NOTHING;

RAISE NOTICE 'Sample 10-level downline tree created successfully!';
RAISE NOTICE 'Total users created: 30 (3+6+5+3+3+2+2+2+2+2)';
RAISE NOTICE 'Tree structure:';
RAISE NOTICE 'You (Root) -> 3 direct referrals (Level 1)';
RAISE NOTICE '  Alice (2 referrals) -> David (2), Emma (1)';
RAISE NOTICE '  Bob (3 referrals) -> Frank (2), Grace, Henry';
RAISE NOTICE '  Carol (1 referral) -> Ivy';
RAISE NOTICE 'And continues down to Level 10 (Chloe and Dylan)';

END $$;
