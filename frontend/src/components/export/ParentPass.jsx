import { forwardRef, useMemo } from 'react'
import { LOGO_LARGE } from '../../assets/logos'
import { T, serif, sans, splitTime, fmtDay, fmtExportedAt } from './tokens'
import PoweredByMark from './PoweredByMark'

// Ports the auto-fit algorithm from frontend/reference/parent-pass-autofit.html's
// <script> (rowh clamp, tight mode, font-size floors), adapted so 1280 is a
// ceiling rather than a fixed height -- see HEADER_H/FOOTER_H below. Width is
// locked at 720; the card never scrolls or overflows past 720x1280.
const HEADER_H = 214
const FOOTER_H = 66
const MAX_ROW_H = 72
const MAX_FRAME_H = 1280

function buildRows(bookings) {
  const sorted = [...bookings].sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
  const rows = []
  sorted.forEach((b, i) => {
    rows.push({ free: false, b })
    const next = sorted[i + 1]
    if (next && new Date(b.end_time) < new Date(next.start_time)) {
      const minutes = Math.round((new Date(next.start_time) - new Date(b.end_time)) / 60000)
      rows.push({ free: true, start: b.end_time, minutes })
    }
  })
  return rows
}

const ParentPass = forwardRef(function ParentPass(
  { studentName, grade, section, parentName, ptmDate, bookings, exportedBy, exportedAt },
  ref
) {
  const rows = useMemo(() => buildRows(bookings || []), [bookings])

  // Height grows with row count at the comfortable max (72px/row) until the
  // frame would exceed 1280px, then switches to compressing rows to fit --
  // 9:16 is a ceiling, not a fixed size.
  const naturalListH = rows.length * MAX_ROW_H
  const frameH = Math.min(MAX_FRAME_H, HEADER_H + FOOTER_H + naturalListH)
  const listH = frameH - HEADER_H - FOOTER_H
  const rowh = rows.length ? Math.max(26, Math.min(MAX_ROW_H, Math.floor(listH / rows.length))) : MAX_ROW_H
  const tight = rowh < 44
  const fsT = Math.max(10.5, Math.min(16, rowh * 0.30))
  const fsN = Math.max(10.5, Math.min(15, rowh * 0.29))
  const fsS = Math.max(9, Math.min(12.5, rowh * 0.24))
  const fsL = Math.max(8.5, Math.min(11.5, rowh * 0.22))
  const tcol = tight ? 74 : 90

  const span = bookings && bookings.length
    ? `${bookings.length} meeting${bookings.length === 1 ? '' : 's'}`
    : 'No meetings booked'

  return (
    <div ref={ref} style={{
      width: 720, height: frameH, background: T.paper, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', fontFamily: sans, color: T.body,
    }}>
      <div style={{ background: T.orange, color: '#fff', padding: '28px 34px 24px', flexShrink: 0 }}>
        <img src={LOGO_LARGE} alt="Inventure Academy" style={{ height: 30, display: 'block' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, marginTop: 20 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.85)' }}>Schedule for</div>
            <div style={{ fontFamily: serif, fontSize: 38, fontWeight: 600, letterSpacing: '-.025em', lineHeight: 1, marginTop: 6, color: '#fff' }}>{studentName}</div>
            {/* `section` already carries the grade digit in this school's data
                (e.g. "7C"), so pairing it with a separate "Grade 7" would repeat
                it -- fall back to "Grade N" only when section is missing. */}
            <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,.92)', marginTop: 7 }}>{section ? `Section ${section}` : (grade ? `Grade ${grade}` : '')}</div>
            {parentName && <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.85)', marginTop: 3 }}>Parent: {parentName}</div>}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: '#fff', letterSpacing: '-.01em', lineHeight: 1.12 }}>{fmtDay(ptmDate)}</div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.92)', marginTop: 7, fontVariantNumeric: 'tabular-nums' }}>{span}</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '0 34px', overflow: 'hidden' }}>
        {rows.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: T.soft, fontSize: 14 }}>No meetings booked yet.</div>
        )}
        {rows.map((r, i) => {
          if (r.free) {
            const { time, ap } = splitTime(r.start)
            return (
              <div key={`f${i}`} style={{ display: 'grid', gridTemplateColumns: `${tcol}px 1fr auto`, gap: 14, alignItems: 'center', borderTop: `1px solid ${T.hair}`, height: rowh }}>
                <div style={{ fontSize: fsT, fontWeight: 600, color: T.orange, whiteSpace: 'nowrap' }}>
                  {time}
                  <i style={{ fontStyle: 'normal', fontSize: '.72em', fontWeight: 600, marginLeft: 3 }}>{ap}</i>
                </div>
                <div style={{ fontSize: fsS, fontWeight: 600, color: T.orange, letterSpacing: '.06em', textTransform: 'uppercase' }}>Free · {r.minutes} min</div>
                <div />
              </div>
            )
          }
          const b = r.b
          const { time, ap } = splitTime(b.start_time)
          return (
            <div key={b.id || i} style={{ display: 'grid', gridTemplateColumns: `${tcol}px 1fr auto`, gap: 14, alignItems: 'center', borderTop: `1px solid ${T.hair}`, height: rowh }}>
              <div style={{ fontSize: fsT, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: T.ink, letterSpacing: '-.02em', whiteSpace: 'nowrap' }}>
                {time}
                <i style={{ fontStyle: 'normal', fontSize: '.72em', fontWeight: 600, color: T.faint, marginLeft: 3 }}>{ap}</i>
              </div>
              <div>
                <div style={{ fontSize: fsN, fontWeight: 600, color: T.ink2, lineHeight: 1.18 }}>
                  {b.teacher_name}{tight && b.teacher_subject ? ` · ${b.teacher_subject}` : ''}
                </div>
                {!tight && b.teacher_subject && <div style={{ fontSize: fsS, color: T.soft, marginTop: 1 }}>{b.teacher_subject}</div>}
              </div>
              <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: fsS, fontWeight: 700, color: T.ink2 }}>{b.room || ''}</div>
                {!tight && b.room_location && <div style={{ fontSize: fsL, color: T.soft, marginTop: 1 }}>{b.room_location}</div>}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, padding: '14px 34px 18px', borderTop: `1px solid ${T.rule}`, background: '#FAF7F1' }}>
        <div style={{ fontSize: 9.5, lineHeight: 1.5, color: T.faint, maxWidth: 430 }}>
          Confidential — contains student information. Not for sharing outside the school.
          {exportedBy && <><br />Exported by {exportedBy} · {fmtExportedAt(exportedAt)}</>}
        </div>
        <PoweredByMark />
      </div>
    </div>
  )
})

export default ParentPass
