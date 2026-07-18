-- Per-meeting private notes. One editable note per (booking, author).
-- Privacy is enforced in the API by author_id; the row itself is not shared.
CREATE TABLE IF NOT EXISTS meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  author_role TEXT NOT NULL,
  note_text TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(booking_id, author_id)
);
