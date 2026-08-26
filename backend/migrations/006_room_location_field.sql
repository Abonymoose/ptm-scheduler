-- Building/floor line shown under `room` on schedule exports (e.g. "Middle
-- School · 1st floor"). Split into a separate column, not appended to `room`,
-- because the export layouts render them as two distinct lines of type.
ALTER TABLE users ADD COLUMN IF NOT EXISTS room_location TEXT;
