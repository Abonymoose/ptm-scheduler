import { forwardRef } from 'react'
import { LOGO_LARGE } from '../../assets/logos'
import { T, serif, sans, splitTime, fmtTime, fmtDay, fmtExportedAt } from './tokens'
import PoweredByMark from './PoweredByMark'

// A4 print sheets, ported from frontend/reference/export-mockups-v6.html's
// .sheet block. Rendered at natural width; frontend/src/styles/print.css
// takes over sizing (width:auto, no shadow) when actually printed.
const sheetStyle = { width: 794, background: '#fff', padding: '44px 54px 38px', fontFamily: sans, color: T.body }
const logoStyle = { height: 28, display: 'block', filter: 'invert(1)' } // source art is white-on-transparent

function SheetTop({ who, role, eyebrow, day, stat }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 30, paddingBottom: 16, borderBottom: `2px solid ${T.ink}` }}>
      <div>
        <img src={LOGO_LARGE} alt="Inventure Academy" style={logoStyle} />
        <div style={{ fontFamily: serif, fontSize: 31, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1, marginTop: 16, color: T.ink }}>{who}</div>
        <div style={{ fontSize: 13, color: T.soft, marginTop: 7 }}>{role}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: T.orange }}>{eyebrow}</div>
        <div style={{ fontFamily: serif, fontSize: 17, fontWeight: 600, marginTop: 5, color: T.ink }}>{day}</div>
        <div style={{ fontSize: 12, color: T.soft, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{stat}</div>
      </div>
    </div>
  )
}

function SheetFoot({ conf, exportedBy, exportedAt, maxWidth }) {
  return (
    <div style={{ marginTop: 26, paddingTop: 14, borderTop: `1px solid ${T.rule}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 }}>
      <div style={{ fontSize: 10, lineHeight: 1.55, color: T.faint, maxWidth }}>
        {conf}
        {exportedBy && <><br />Exported by {exportedBy} · {fmtExportedAt(exportedAt)}</>}
      </div>
      <PoweredByMark />
    </div>
  )
}

// No time-of-day word: see the matching comment in TeacherPass.jsx -- the
// split is just first-half/second-half, so a fixed label could contradict
// itself. The range alone always tells the truth.
function bandLabel(col) {
  if (!col.length) return ''
  return `${fmtTime(col[0].start_time)} – ${fmtTime(col[col.length - 1].end_time)}`
}

export const TeacherDaySheet = forwardRef(function TeacherDaySheet(
  { teacherName, subject, room, ptmDate, slots, exportedBy, exportedAt },
  ref
) {
  const bookedCount = (slots || []).filter(s => s.state === 'booked').length
  const openCount = (slots || []).length - bookedCount
  const splitAt = Math.ceil((slots || []).length / 2)
  const colA = (slots || []).slice(0, splitAt)
  const colB = (slots || []).slice(splitAt)

  return (
    <div ref={ref} className="print-sheet" style={sheetStyle}>
      <SheetTop
        who={teacherName}
        role={<>{subject}{room ? <> · Room <b style={{ color: T.orange, fontWeight: 600 }}>{room}</b></> : null}</>}
        eyebrow="Day sheet"
        day={fmtDay(ptmDate)}
        stat={`${bookedCount} of ${(slots || []).length} booked · ${openCount} open`}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', marginTop: 22 }}>
        <div style={{ padding: '0 26px 0 0' }}>
          <Band label={bandLabel(colA)} />
          {colA.map(s => <Slot key={s.id} slot={s} />)}
        </div>
        <div style={{ background: T.hair }} />
        <div style={{ padding: '0 0 0 26px' }}>
          <Band label={bandLabel(colB)} />
          {colB.map(s => <Slot key={s.id} slot={s} />)}
        </div>
      </div>
      <SheetFoot conf="Confidential — contains student and parent information. Not for sharing outside the school." exportedBy={exportedBy} exportedAt={exportedAt} maxWidth={420} />
    </div>
  )
})

function Band({ label }) {
  return <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: T.faint, padding: '14px 0 8px' }}>{label}</div>
}

function Slot({ slot }) {
  const open = slot.state !== 'booked'
  const { time } = splitTime(slot.start_time)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '46px 1fr', gap: 12, alignItems: 'center', height: 38, borderTop: `1px solid ${T.hair}` }}>
      <div style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: open ? T.faint : T.ink }}>{time}</div>
      <div>
        <div style={{ fontSize: open ? 10 : 12.5, fontWeight: 600, lineHeight: 1.2, color: open ? T.faint : T.ink2, letterSpacing: open ? '.1em' : 'normal', textTransform: open ? 'uppercase' : 'none' }}>
          {open ? 'Open' : (slot.parent_name || '—')}
        </div>
        {!open && <div style={{ fontSize: 11, color: T.soft, marginTop: 1 }}>{slot.student_name}{slot.section ? ` · ${slot.section}` : ''}</div>}
      </div>
    </div>
  )
}

export const ParentScheduleSheet = forwardRef(function ParentScheduleSheet(
  { studentName, grade, section, parentName, ptmDate, bookings, exportedBy, exportedAt },
  ref
) {
  const sorted = [...(bookings || [])].sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
  const stat = sorted.length
    ? `${sorted.length} meeting${sorted.length === 1 ? '' : 's'} · ${fmtTime(sorted[0].start_time)} – ${fmtTime(sorted[sorted.length - 1].end_time)}`
    : 'No meetings booked'

  return (
    <div ref={ref} className="print-sheet" style={sheetStyle}>
      <SheetTop
        who={studentName}
        // `section` already carries the grade digit in this school's data (e.g.
        // "7C"), so pairing it with "Grade 7" would repeat it -- fall back to
        // "Grade N" only when section is missing.
        role={`${section ? `Section ${section}` : (grade ? `Grade ${grade}` : '')}${parentName ? ` · Parent: ${parentName}` : ''}`}
        eyebrow="Parent schedule"
        day={fmtDay(ptmDate)}
        stat={stat}
      />
      <div style={{ marginTop: 24 }}>
        {sorted.length === 0 && (
          <div style={{ padding: '30px 0', textAlign: 'center', color: T.soft, fontSize: 13 }}>No meetings booked yet.</div>
        )}
        {sorted.map((b, i) => {
          const { time, ap } = splitTime(b.start_time)
          return (
            <div key={b.id || i} style={{ display: 'grid', gridTemplateColumns: '118px 1fr 110px', gap: 20, alignItems: 'center', height: 48, borderTop: `1px solid ${T.hair}` }}>
              <div style={{ fontFamily: serif, fontSize: 19, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em', color: T.ink }}>{time} {ap}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.ink2 }}>{b.teacher_name}</div>
                {b.teacher_subject && <div style={{ fontSize: 12.5, color: T.soft, marginTop: 1 }}>{b.teacher_subject}</div>}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.soft, textAlign: 'right' }}>{b.room || ''}</div>
            </div>
          )
        })}
      </div>
      <SheetFoot conf="Confidential — contains student information. Not for sharing outside the school." exportedBy={exportedBy} exportedAt={exportedAt} maxWidth={420} />
    </div>
  )
})
