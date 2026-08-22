-- Failed-attempt counter for OTP verification, closing off unlimited guessing
-- against one issued code. Defaults to 0 so existing rows and any INSERT that
-- doesn't list this column (all current ones) keep working unmodified.
ALTER TABLE otps ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
