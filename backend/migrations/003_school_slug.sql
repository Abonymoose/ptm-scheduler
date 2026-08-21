-- Per-school URL slug for branded login pages (e.g. /inventure). Added nullable
-- first, backfilled, then locked to NOT NULL + UNIQUE so the existing row migrates
-- cleanly. Assumes Inventure is the only existing school (true for current data).
ALTER TABLE schools ADD COLUMN IF NOT EXISTS slug TEXT;

-- Backfill the existing school by id (name match is fragile — trailing space or
-- casing would zero-match, then SET NOT NULL below would fail on the null).
UPDATE schools SET slug = 'inventure'
WHERE id = '21627bd2-7469-425a-bd2b-401e1eaccc44' AND slug IS NULL;

ALTER TABLE schools ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS schools_slug_key ON schools (slug);
