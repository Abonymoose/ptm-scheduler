-- Runtime-editable app settings (first use: email routing overrides for the
-- Demo tab, so EMAIL_OVERRIDE_TO/EMAIL_ALLOWLIST can change live without a
-- server restart). Generic key/value store; email_service.py falls back to
-- the env vars of the same name when a key has no row here.
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
