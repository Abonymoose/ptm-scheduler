-- Short room label for a teacher (e.g. "7A", "Lab 2"), used on schedule exports.
-- Separate from the existing freeform `venue` field, which stays as-is.
ALTER TABLE users ADD COLUMN IF NOT EXISTS room TEXT;
