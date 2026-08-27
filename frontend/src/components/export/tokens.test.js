import { describe, it, expect } from 'vitest'
import { fmtTime, splitTime, fmtDay } from './tokens'

// Slot start_time/end_time (and ptm_date) are naive local IST clock values
// merely labelled UTC in the DB (see CLAUDE.md) -- e.g. an 8:10 AM PTM slot
// is stored as "...T08:10:00+00:00", NOT as the real UTC instant for 8:10 AM
// IST. They must render as the stored digits verbatim, with no timezone
// conversion applied, regardless of the viewer's own system timezone.
describe('export time formatting renders stored clock values verbatim', () => {
  const EIGHT_TEN_AM = '2026-12-12T08:10:00+00:00'

  it('fmtTime renders 8:10, not 1:40 (no +5:30 IST conversion)', () => {
    // 'en-IN' renders the meridiem lowercase ("am"/"pm") -- that's an
    // Intl locale detail, not the bug under test; the hour:minute is what
    // must never shift.
    expect(fmtTime(EIGHT_TEN_AM)).toBe('8:10 am')
  })

  it('splitTime agrees with fmtTime', () => {
    expect(splitTime(EIGHT_TEN_AM)).toEqual({ time: '8:10', ap: 'am' })
  })

  it('fmtDay renders the stored calendar date, not a timezone-shifted one', () => {
    expect(fmtDay(EIGHT_TEN_AM)).toBe('Saturday, 12 December')
  })

  it('a near-midnight stored time does not roll to the next/previous day', () => {
    // 23:50 -- adding 5:30 (a real IST conversion) would push this past
    // midnight into the 13th. It must stay on the 12th.
    expect(fmtTime('2026-12-12T23:50:00+00:00')).toBe('11:50 pm')
    expect(fmtDay('2026-12-12T23:50:00+00:00')).toBe('Saturday, 12 December')
  })
})
