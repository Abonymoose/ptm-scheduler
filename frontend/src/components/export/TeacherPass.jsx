import { forwardRef } from 'react'
import { LOGO_LARGE } from '../../assets/logos'
import { T, serif, sans, splitTime, fmtTime, fmtDay, fmtExportedAt } from './tokens'
import PoweredByMark from './PoweredByMark'

// No time-of-day word (Morning/Afternoon/...): the split is just first-half /
// second-half of the day's slots, not a real time-of-day boundary, so a fixed
// label could read self-contradictory (e.g. both halves landing in the
// afternoon). The range itself always tells the truth.
function bandLabel(col) {
  if (!col.length) return ''
  return `${fmtTime(col[0].start_time)} – ${fmtTime(col[col.length - 1].end_time)}`
}

function Row({ slot }) {
  // Blocked (teacher-break) slots have no confirmed booking either, same as
  // free ones -- both render as "Open" here; this is a private day sheet,
  // not a bookable view.
  const open = slot.state !== 'booked'
  const { time } = splitTime(slot.start_time)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '54px 1fr', gap: 12, alignItems: 'center', height: 42, borderTop: `1px solid ${T.hair}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: open ? T.orange : T.ink, letterSpacing: '-.02em', whiteSpace: 'nowrap' }}>{time}</div>
      <div>
        <div style={{ fontSize: open ? 11.5 : 13, fontWeight: open ? 600 : 600, color: open ? T.orange : T.ink2, lineHeight: 1.2, letterSpacing: open ? '.08em' : 'normal', textTransform: open ? 'uppercase' : 'none' }}>
          {open ? 'Open' : (slot.parent_name || '—')}
        </div>
        {!open && <div style={{ fontSize: 11, color: T.soft, marginTop: 1 }}>{slot.student_name}{slot.section ? ` · ${slot.section}` : ''}</div>}
      </div>
    </div>
  )
}

const TeacherPass = forwardRef(function TeacherPass(
  { teacherName, subject, room, ptmDate, slots, exportedBy, exportedAt },
  ref
) {
  const bookedCount = (slots || []).filter(s => s.state === 'booked').length
  const openCount = (slots || []).length - bookedCount
  const splitAt = Math.ceil((slots || []).length / 2)
  const colA = (slots || []).slice(0, splitAt)
  const colB = (slots || []).slice(splitAt)

  return (
    <div ref={ref} style={{ width: 680, background: T.paper, fontFamily: sans, color: T.body, overflow: 'hidden' }}>
      <div style={{ background: T.orange, color: '#fff', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 30 }}>
        <div>
          <img src={LOGO_LARGE} alt="Inventure Academy" style={{ height: 30, display: 'block' }} />
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.85)', marginTop: 20 }}>Day sheet for</div>
          <div style={{ fontFamily: serif, fontSize: 36, fontWeight: 600, letterSpacing: '-.025em', lineHeight: 1, marginTop: 5, color: '#fff' }}>{teacherName}</div>
          {subject && <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,.92)', marginTop: 7 }}>{subject}</div>}
          {room && (
            <div style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, letterSpacing: '.04em', background: 'rgba(255,255,255,.22)', padding: '4px 10px', borderRadius: 3, marginTop: 10 }}>
              Room {room}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, paddingTop: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,.85)' }}>Parent-teacher meeting</div>
          <div style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: '#fff', marginTop: 8, letterSpacing: '-.01em' }}>{fmtDay(ptmDate)}</div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.92)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{bookedCount} booked · {openCount} open</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', padding: '8px 0 2px' }}>
        <div style={{ padding: '0 26px' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: T.faint, padding: '14px 0 8px' }}>{bandLabel(colA)}</div>
          {colA.map(s => <Row key={s.id} slot={s} />)}
        </div>
        <div style={{ background: T.hair, margin: '14px 0' }} />
        <div style={{ padding: '0 26px' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: T.faint, padding: '14px 0 8px' }}>{bandLabel(colB)}</div>
          {colB.map(s => <Row key={s.id} slot={s} />)}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, padding: '16px 32px 18px', marginTop: 10, borderTop: `1px solid ${T.rule}`, background: '#FAF7F1' }}>
        <div style={{ fontSize: 9.5, lineHeight: 1.5, color: T.faint, maxWidth: 400 }}>
          Confidential — contains student and parent information. Not for sharing outside the school.
          {exportedBy && <><br />Exported by {exportedBy} · {fmtExportedAt(exportedAt)}</>}
        </div>
        <PoweredByMark />
      </div>
    </div>
  )
})

export default TeacherPass
