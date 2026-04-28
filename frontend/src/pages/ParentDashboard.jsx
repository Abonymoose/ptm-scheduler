import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSlots } from '../api/slots'
import { createBooking, getMyBookings, cancelBooking, autoSchedule } from '../api/bookings'

const C = { orange: '#F47920', navy: '#1B3F7A', bg: '#FFF8F3', border: '#F4C099', grey: '#9CA3AF', lightOrange: '#FFF0E6' }

const CHILDREN = [
  { key: 'p', label: 'Parshv Gr7', color: '#F47920', bg: '#FFF0E6', border: '#F47920', textColor: '#C45A0A' },
  { key: 'd', label: 'Dhriti Gr4', color: '#2563EB', bg: '#EFF6FF', border: '#93C5FD', textColor: '#1D4ED8' },
]

const fmt = iso => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg }) {
  return (
    <div style={{ position: 'fixed', bottom: 'clamp(16px,2.5vw,28px)', left: '50%', transform: 'translateX(-50%)', background: C.navy, color: '#fff', padding: 'clamp(10px,1.4vw,16px) clamp(18px,2.5vw,28px)', borderRadius: 50, fontSize: 'clamp(13px,1.6vw,17px)', fontWeight: 600, opacity: msg ? 1 : 0, transition: 'opacity .3s', pointerEvents: 'none', zIndex: 999, maxWidth: 'calc(100vw - 32px)', textAlign: 'center', whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(27,63,122,.3)' }}>
      {msg}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ show, title, sub, onConfirm, confirmLabel = 'Confirm', onBack, backLabel = 'Back' }) {
  if (!show) return null
  return (
    <div onClick={onBack} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20, backdropFilter: 'blur(2px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 'clamp(24px,3.5vw,40px)', width: '100%', maxWidth: 'min(380px,calc(100vw - 32px))', textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,.15)' }}>
        <div style={{ fontSize: 'clamp(17px,2.2vw,24px)', fontWeight: 700, color: C.navy, marginBottom: 8, letterSpacing: '-.02em' }}>{title}</div>
        <div style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: C.grey, marginBottom: 'clamp(20px,3vw,30px)', lineHeight: 1.5 }}>{sub}</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onBack} style={{ flex: 1, padding: 'clamp(12px,1.6vw,16px)', borderRadius: 12, fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 700, cursor: 'pointer', border: '2px solid #F4C099', background: '#fff', color: C.grey, fontFamily: 'inherit' }}>{backLabel}</button>
          {onConfirm && <button onClick={onConfirm} style={{ flex: 1, padding: 'clamp(12px,1.6vw,16px)', borderRadius: 12, fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 700, cursor: 'pointer', border: 'none', background: C.orange, color: '#fff', fontFamily: 'inherit', boxShadow: '0 2px 10px rgba(244,121,32,.3)' }}>{confirmLabel}</button>}
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ParentDashboard() {
  const { user, logoutUser } = useAuth()
  const [slots, setSlots] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [child, setChild] = useState(CHILDREN[0])
  const [tab, setTab] = useState('book')
  const [hoveredCancel, setHoveredCancel] = useState(null)
  // auto-schedule state
  const [autoModal, setAutoModal] = useState(false)
  const [autoScheduling, setAutoScheduling] = useState(false)
  const [autoResult, setAutoResult] = useState(null)
  const [selectedTeachers, setSelectedTeachers] = useState(new Set())
  // cancel modal
  const [cancelModal, setCancelModal] = useState(null)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const [s, b] = await Promise.all([getSlots(), getMyBookings()])
      setSlots(s)
      setBookings(b)
    } catch { setError('Failed to load data') }
    setLoading(false)
  }

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const bookedSlotIds = new Set(bookings.filter(b => b.status !== 'cancelled').map(b => b.slot_id))
  const slotToBookingId = Object.fromEntries(bookings.filter(b => b.status !== 'cancelled').map(b => [b.slot_id, b.id]))
  const activeBookings = bookings.filter(b => b.status !== 'cancelled')

  const groupByTeacher = () => {
    const map = {}
    slots.forEach(s => { if (!map[s.teacher_name]) map[s.teacher_name] = []; map[s.teacher_name].push(s) })
    return map
  }

  const handleBook = async slot_id => {
    try { await createBooking(slot_id); showToast('Booking confirmed!'); fetchData() }
    catch (err) { showToast(err.response?.data?.detail || 'Booking failed') }
  }

  const handleCancel = async () => {
    if (!cancelModal) return
    try { await cancelBooking(cancelModal.booking_id); showToast('Booking cancelled'); fetchData() }
    catch { showToast('Failed to cancel') }
    setCancelModal(null)
  }

  const openAutoModal = () => {
    setSelectedTeachers(new Set(teacherOptions.map(t => t.id)))
    setAutoResult(null)
    setAutoModal(true)
  }
  const toggleTeacher = id => {
    setSelectedTeachers(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const handleAutoSchedule = async () => {
    setAutoScheduling(true)
    try {
      const result = await autoSchedule([...selectedTeachers])
      setAutoResult(result)
      fetchData()
    } catch (err) { showToast(err.response?.data?.detail || 'Auto-schedule failed') }
    setAutoScheduling(false)
  }

  const teacherGroups = groupByTeacher()
  const teachers = Object.keys(teacherGroups)
  const teacherOptions = [...new Map(slots.map(s => [s.teacher_id, s.teacher_name])).entries()].map(([id, name]) => ({ id, name }))
  const allTimes = [...new Set(slots.map(s => s.start_time))].sort()
  const initials = user?.name ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'PM'

  if (loading) return <div style={{ minHeight: '100svh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif', color: C.orange, fontWeight: 600 }}>Loading…</div>

  return (
    <div style={{ background: C.bg, minHeight: '100svh', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 'clamp(10px,1.5vw,18px)', overflow: 'hidden', width: 'min(96vw,960px)', margin: 'clamp(10px,2vw,20px) auto', boxShadow: '0 2px 20px rgba(0,0,0,.06)', display: 'flex', flexDirection: 'column', height: 'calc(100svh - clamp(20px,4vw,40px))' }}>

        {/* Topbar */}
        <div style={{ padding: 'clamp(12px,1.8vw,20px) clamp(16px,2.5vw,28px)', background: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px,1.5vw,16px)' }}>
            <div style={{ width: 'clamp(36px,4.5vw,48px)', height: 'clamp(36px,4.5vw,48px)', borderRadius: '50%', background: 'rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(13px,1.6vw,17px)', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials}</div>
            <div>
              <div style={{ fontSize: 'clamp(15px,2vw,22px)', fontWeight: 700, color: '#fff', letterSpacing: '-.03em' }}>{user?.name || 'Parent'}</div>
              <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: 'rgba(255,255,255,.8)', marginTop: 2 }}>Inventure Academy · PTM 09 Apr 2026</div>
            </div>
          </div>
          <button onClick={logoutUser} style={{ fontSize: 'clamp(10px,1.2vw,13px)', fontWeight: 600, padding: 'clamp(4px,.8vw,8px) clamp(10px,1.5vw,16px)', borderRadius: 20, background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: '#fff', borderBottom: `2px solid ${C.border}`, flexShrink: 0 }}>
          {[['book', 'Book'], ['sched', `My schedule${activeBookings.length ? ` (${activeBookings.length})` : ''}`]].map(([key, lbl]) => (
            <div key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: 'clamp(12px,1.8vw,18px) 8px', textAlign: 'center', fontSize: 'clamp(13px,1.6vw,17px)', fontWeight: 600, cursor: 'pointer', color: tab === key ? C.orange : '#C4B5A5', borderBottom: `3px solid ${tab === key ? C.orange : 'transparent'}`, marginBottom: -2, transition: 'all .2s', letterSpacing: '-.01em' }}>{lbl}</div>
          ))}
        </div>

        {tab === 'book' ? (
          <>
            {/* Child selector */}
            <div style={{ padding: 'clamp(10px,1.4vw,16px) clamp(16px,2.5vw,28px)', background: C.bg, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 'clamp(8px,1.2vw,14px)', flexWrap: 'nowrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch', flexShrink: 0 }}>
              <span style={{ fontSize: 'clamp(11px,1.3vw,15px)', color: C.grey, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>Tap to select:</span>
              {CHILDREN.map(c => (
                <div key={c.key} onClick={() => setChild(c)} style={{ fontSize: 'clamp(11px,1.3vw,14px)', fontWeight: 600, padding: 'clamp(6px,.9vw,10px) clamp(10px,1.4vw,16px)', borderRadius: 50, border: `2px solid ${child.key === c.key ? c.border : C.border}`, background: child.key === c.key ? c.bg : '#fff', color: child.key === c.key ? c.textColor : '#C4B5A5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, transition: 'all .15s' }}>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: child.key === c.key ? c.color : '#D1D5DB', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {child.key === c.key && <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><polyline points="2,5 4,7.5 8,2.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </span>
                  {c.label}
                </div>
              ))}
              <button onClick={openAutoModal} style={{ marginLeft: 'auto', fontSize: 'clamp(11px,1.3vw,15px)', fontWeight: 700, padding: 'clamp(7px,1vw,12px) clamp(12px,1.6vw,20px)', borderRadius: 50, background: C.orange, color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, boxShadow: '0 2px 12px rgba(244,121,32,.3)', fontFamily: 'inherit' }}>Auto-schedule</button>
            </div>

            {/* Grid */}
            <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ padding: 0, width: 'clamp(48px,6vw,64px)', textAlign: 'left', borderBottom: `2px solid ${C.orange}`, background: C.bg, verticalAlign: 'bottom', position: 'sticky', top: 0, zIndex: 5, paddingBottom: 8, paddingLeft: 'clamp(10px,1.5vw,18px)', fontSize: 'clamp(10px,1.2vw,13px)', fontWeight: 600, color: C.grey }}>Time</th>
                    {teachers.map(t => (
                      <th key={t} style={{ padding: 0, textAlign: 'center', borderBottom: `2px solid ${C.orange}`, background: C.bg, verticalAlign: 'bottom', minWidth: 'clamp(80px,9vw,110px)', position: 'sticky', top: 0, zIndex: 5 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 5, height: '100%', padding: '8px 4px' }}>
                          <span style={{ fontSize: 'clamp(11px,1.3vw,14px)', fontWeight: 700, color: C.navy, textAlign: 'center', wordBreak: 'break-word', lineHeight: 1.2, width: '100%' }}>{t}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allTimes.map(time => (
                    <tr key={time}>
                      <td style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: C.grey, paddingLeft: 'clamp(10px,1.5vw,18px)', background: C.bg, fontWeight: 600, borderRight: `2px solid ${C.border}`, height: 'clamp(32px,4vw,44px)', verticalAlign: 'middle', border: `1px solid #F0E4D4` }}>{fmt(time)}</td>
                      {teachers.map(t => {
                        const slot = teacherGroups[t]?.find(s => s.start_time === time)
                        if (!slot) return <td key={t} style={{ border: '1px solid #F0E4D4', height: 'clamp(32px,4vw,44px)', background: '#FAFAFA' }} />
                        const isBooked = bookedSlotIds.has(slot.id)
                        const isFull = slot.booked_count >= slot.capacity && !isBooked
                        const isHovered = hoveredCancel === slot.id
                        return (
                          <td key={t} style={{ padding: 2, border: '1px solid #F0E4D4', height: 'clamp(32px,4vw,44px)', verticalAlign: 'middle' }}>
                            <button
                              onClick={() => {
                                if (isBooked) { setCancelModal({ slot_id: slot.id, booking_id: slotToBookingId[slot.id], teacher: t }); return }
                                if (!isFull) handleBook(slot.id)
                              }}
                              onMouseEnter={() => isBooked && setHoveredCancel(slot.id)}
                              onMouseLeave={() => setHoveredCancel(null)}
                              style={{ width: '100%', height: '100%', borderRadius: 8, border: isBooked ? `1.5px solid ${child.border}` : 'none', cursor: isFull && !isBooked ? 'default' : 'pointer', background: isBooked && isHovered ? '#FEE2E2' : isBooked ? child.bg : isFull ? '#F5F0EC' : 'transparent', color: isBooked && isHovered ? '#DC2626' : isBooked ? child.textColor : isFull ? '#C4B5A5' : '#F4C099', fontSize: 'clamp(11px,1.3vw,14px)', fontWeight: isBooked ? 700 : 300, transition: 'all .1s', fontFamily: 'inherit' }}>
                              {isBooked ? (isHovered ? '×' : '✓') : isFull ? '—' : '+'}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 'clamp(10px,1.5vw,18px)', padding: 'clamp(10px,1.4vw,14px) clamp(16px,2.5vw,28px)', borderTop: `1px solid ${C.border}`, background: C.bg, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: C.grey, fontWeight: 600, marginRight: 4 }}>Legend:</span>
              {[{ label: 'Parshv', bg: '#FFF0E6', border: C.orange }, { label: 'Dhriti', bg: '#EFF6FF', border: '#93C5FD' }, { label: 'Taken', bg: '#F5F0EC', border: '#E5D5C5' }].map(l => (
                <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'clamp(11px,1.3vw,14px)', color: '#6B7280', fontWeight: 500 }}>
                  <span style={{ width: 'clamp(14px,1.8vw,20px)', height: 'clamp(14px,1.8vw,20px)', borderRadius: 5, background: l.bg, border: `2px solid ${l.border}`, flexShrink: 0, display: 'inline-block' }} />
                  {l.label}
                </span>
              ))}
            </div>

            {/* Bottom bar */}
            <div style={{ padding: 'clamp(12px,1.8vw,18px) clamp(16px,2.5vw,28px)', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.bg, flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#C45A0A', fontWeight: 600 }}>{activeBookings.length} teacher{activeBookings.length !== 1 ? 's' : ''} booked</span>
            </div>
          </>
        ) : (
          <>
            {/* My schedule */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {activeBookings.length === 0 ? (
                <div style={{ padding: 'clamp(32px,5vw,60px)', textAlign: 'center', color: '#C4B5A5', fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 500 }}>No bookings yet</div>
              ) : activeBookings.sort((a, b) => new Date(a.start_time) - new Date(b.start_time)).map(bk => (
                <div key={bk.id} style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid #F4EDE4`, minHeight: 'clamp(62px,8vw,80px)', background: '#fff' }}>
                  <div style={{ width: 'clamp(52px,7vw,72px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px', flexShrink: 0 }}>
                    <div style={{ fontSize: 'clamp(13px,1.6vw,18px)', fontWeight: 700, color: C.navy, letterSpacing: '-.03em' }}>{fmt(bk.start_time)}</div>
                  </div>
                  <div style={{ width: 3, flexShrink: 0, alignSelf: 'stretch', background: C.orange }} />
                  <div style={{ flex: 1, minWidth: 0, padding: 'clamp(10px,1.4vw,14px) clamp(14px,2vw,18px)' }}>
                    <div style={{ fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 700, color: C.navy, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bk.teacher_name}</div>
                    <div style={{ fontSize: 'clamp(11px,1.3vw,15px)', color: C.grey, marginTop: 2 }}>{fmt(bk.start_time)} – {fmt(bk.end_time)}</div>
                  </div>
                  <button
                    onClick={() => setCancelModal({ slot_id: bk.slot_id, booking_id: bk.id, teacher: bk.teacher_name })}
                    onMouseEnter={e => e.currentTarget.style.color = C.orange}
                    onMouseLeave={e => e.currentTarget.style.color = '#C4B5A5'}
                    style={{ width: 'clamp(28px,3.5vw,38px)', height: 'clamp(28px,3.5vw,38px)', borderRadius: 8, background: '#fff', border: 'none', color: '#C4B5A5', cursor: 'pointer', fontSize: 'clamp(18px,2.2vw,26px)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 'clamp(14px,2vw,22px)', fontWeight: 300, lineHeight: 1, padding: 0, transition: 'color .12s' }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ padding: 'clamp(12px,1.8vw,18px) clamp(16px,2.5vw,28px)', borderTop: `1px solid ${C.border}`, background: C.bg, flexShrink: 0 }}>
              <span style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#C45A0A', fontWeight: 600 }}>{activeBookings.length} meeting{activeBookings.length !== 1 ? 's' : ''} booked</span>
            </div>
          </>
        )}
      </div>

      {/* Cancel modal */}
      <Modal show={!!cancelModal} title="Cancel this meeting?" sub={cancelModal ? `Cancel your meeting with ${cancelModal.teacher}?` : ''} onConfirm={handleCancel} confirmLabel="Yes, cancel" onBack={() => setCancelModal(null)} backLabel="Keep it" />

      {/* Auto-schedule modal */}
      {autoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20, backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 'min(400px,calc(100vw - 32px))', boxShadow: '0 12px 40px rgba(0,0,0,.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
            {autoResult === null ? (
              <>
                <div style={{ padding: 'clamp(18px,2.5vw,28px) clamp(20px,2.8vw,28px) clamp(12px,1.8vw,18px)', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 'clamp(16px,2vw,22px)', fontWeight: 800, color: C.navy }}>✦ Auto-schedule</div>
                  <div style={{ fontSize: 'clamp(12px,1.5vw,15px)', color: C.grey, marginTop: 4 }}>Pick teachers — we'll find a conflict-free schedule</div>
                </div>
                <div style={{ padding: 'clamp(8px,1.2vw,12px) clamp(20px,2.8vw,28px)', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: C.grey }}>{selectedTeachers.size} of {teacherOptions.length} selected</span>
                  <button onClick={() => setSelectedTeachers(selectedTeachers.size === teacherOptions.length ? new Set() : new Set(teacherOptions.map(t => t.id)))} style={{ fontSize: 'clamp(11px,1.3vw,14px)', fontWeight: 700, color: C.orange, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{selectedTeachers.size === teacherOptions.length ? 'Deselect all' : 'Select all'}</button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {teacherOptions.map((t, i) => {
                    const checked = selectedTeachers.has(t.id)
                    return (
                      <div key={t.id} onClick={() => toggleTeacher(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'clamp(10px,1.4vw,14px) clamp(20px,2.8vw,28px)', cursor: 'pointer', borderBottom: i < teacherOptions.length - 1 ? `1px solid ${C.border}` : 'none', background: checked ? C.bg : '#fff', transition: 'background .1s' }}>
                        <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: checked ? `2px solid ${C.orange}` : `1.5px solid ${C.border}`, background: checked ? C.orange : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .1s' }}>
                          {checked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 600, color: C.navy }}>{t.name}</span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ padding: 'clamp(14px,2vw,20px) clamp(20px,2.8vw,28px)', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10 }}>
                  <button onClick={() => setAutoModal(false)} style={{ flex: 1, padding: 'clamp(10px,1.4vw,14px)', fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 700, background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                  <button onClick={handleAutoSchedule} disabled={selectedTeachers.size === 0 || autoScheduling} style={{ flex: 2, padding: 'clamp(10px,1.4vw,14px)', fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 700, background: selectedTeachers.size === 0 || autoScheduling ? C.border : C.orange, color: '#fff', border: 'none', borderRadius: 10, cursor: selectedTeachers.size === 0 || autoScheduling ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'background .15s' }}>
                    {autoScheduling ? 'Scheduling…' : `Schedule ${selectedTeachers.size > 0 ? selectedTeachers.size : ''} meeting${selectedTeachers.size !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ padding: 'clamp(24px,3vw,32px) clamp(20px,2.8vw,28px) clamp(16px,2vw,22px)', textAlign: 'center', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', margin: '0 auto 10px', background: autoResult.booked.length > 0 ? '#FFF0E6' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: autoResult.booked.length > 0 ? '#C45A0A' : C.grey }}>
                    {autoResult.booked.length > 0 ? '✓' : '—'}
                  </div>
                  <div style={{ fontSize: 'clamp(16px,2vw,22px)', fontWeight: 800, color: C.navy }}>
                    {autoResult.booked.length > 0 ? `Scheduled ${autoResult.booked.length} meeting${autoResult.booked.length !== 1 ? 's' : ''}` : 'No slots available'}
                  </div>
                  {autoResult.conflicts.length > 0 && <div style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: C.grey, marginTop: 4 }}>{autoResult.conflicts.length} teacher{autoResult.conflicts.length !== 1 ? 's' : ''} couldn't be scheduled</div>}
                </div>
                <div style={{ overflowY: 'auto', flex: 1, padding: 'clamp(12px,1.8vw,18px) clamp(20px,2.8vw,28px)' }}>
                  {autoResult.booked.map((b, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < autoResult.booked.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.orange, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 700, color: C.navy }}>{b.teacher_name}</div>
                        <div style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: C.grey, marginTop: 1 }}>{fmt(b.start_time)} – {fmt(b.end_time)}</div>
                      </div>
                      <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', fontWeight: 700, color: '#C45A0A', background: '#FFF0E6', padding: '2px 8px', borderRadius: 20 }}>Confirmed</div>
                    </div>
                  ))}
                  {autoResult.conflicts.length > 0 && (
                    <div style={{ marginTop: autoResult.booked.length > 0 ? 14 : 0, background: '#F9FAFB', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ fontSize: 'clamp(11px,1.3vw,13px)', fontWeight: 700, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Could not schedule</div>
                      {autoResult.conflicts.map((name, i) => <div key={i} style={{ fontSize: 'clamp(12px,1.5vw,15px)', color: '#6B7280', padding: '4px 0', borderBottom: i < autoResult.conflicts.length - 1 ? '1px solid #E5E7EB' : 'none' }}>{name}</div>)}
                    </div>
                  )}
                </div>
                <div style={{ padding: 'clamp(14px,2vw,20px) clamp(20px,2.8vw,28px)', borderTop: `1px solid ${C.border}` }}>
                  <button onClick={() => setAutoModal(false)} style={{ width: '100%', padding: 'clamp(12px,1.6vw,16px)', fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 700, background: C.orange, color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }}>Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Toast msg={toast} />
    </div>
  )
}
