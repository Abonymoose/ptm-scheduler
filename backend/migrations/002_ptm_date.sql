-- Per-school PTM date. ADD COLUMN ... DEFAULT backfills existing rows with the
-- default too, so existing schools keep the current date and nothing changes on
-- deploy; new schools inherit the default as well.
ALTER TABLE schools ADD COLUMN IF NOT EXISTS ptm_date DATE DEFAULT '2026-04-09';
