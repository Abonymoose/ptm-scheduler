import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSlots } from '../api/slots'
import { createBooking, getMyBookings, cancelBooking, autoSchedule } from '../api/bookings'

const CHILDREN = [
  { name: 'Parshv', label: 'Parshv Gr7', color: '#F47920', bg: '#FFF0E6', border: '#F47920', textColor: '#C45A0A' },
  { name: 'Dhriti', label: 'Dhriti Gr4', color: '#2563EB', bg: '#EFF6FF', border: '#2563EB', textColor: '#1D4ED8' },
]

const C = {
  orange: '#F47920',
  navy: '#1B3F7A',
  bg: '#FFF8F3',
  border: '#F4C099',
  lightOrange: '#FFF0E6',
  blue: '#2563EB',
  lightBlue: '#EFF6FF',
  grey: '#9CA3AF',
}

function fmt(isoStr) {
  return new Date(isoStr).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function MeetingRow({ booking, onCancel }) {
  const [hov, setHov] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: 'clamp(10px,1.4vw,16px) clamp(12px,1.8vw,22px)', borderBottom: `1px solid ${C.border}`, background: '#fff' }}>
      <div style={{ width: 'clamp(52px,6vw,68px)', textAlign: 'right', fontSize: 'clamp(11px,1.3vw,13px)', fontWeight: 700, color: C.navy, letterSpacing: '-.03em', paddingRight: 12, flexShrink: 0 }}>{fmt(booking.start_time)}</div>
      <div style={{ width: 3, alignSelf: 'stretch', background: C.orange, flexShrink: 0, borderRadius: 2, margin: '0 12px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'clamp(13px,1.6vw,17px)', fontWeight: 700, color: C.navy, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{booking.teacher_name}</div>
        <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: C.grey }}>Inventure Academy · PTM 09 Apr 2026</div>
      </div>
      <button
        onClick={() => onCancel(booking)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{ width: 'clamp(28px,3vw,36px)', height: 'clamp(28px,3vw,36px)', borderRadius: '50%', border: `1.5px solid ${hov ? C.orange : C.border}`, background: hov ? C.lightOrange : '#fff', color: hov ? C.orange : C.grey, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s', fontFamily: 'inherit' }}>×</button>
    </div>
  )
}

function Toast({ msg }) {
  return (
    <div style={{ position: 'fixed', bottom: 'clamp(16px,2.5vw,28px)', left: '50%', transform: 'translateX(-50%)', background: C.navy, color: '#fff', padding: 'clamp(10px,1.4vw,14px) clamp(18px,2.5vw,28px)', borderRadius: 50, fontSize: 'clamp(13px,1.6vw,15px)', fontWeight: 600, opacity: msg ? 1 : 0, transition: 'opacity .3s', pointerEvents: 'none', zIndex: 999, maxWidth: 'calc(100vw - 32px)', textAlign: 'center', whiteSpace: 'nowrap' }}>{msg}</div>
  )
}

export default function ParentDashboard() {
  const { user, logoutUser } = useAuth()
  const [slots, setSlots] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [child, setChild] = useState(CHILDREN[0])
  const [hoveredCancel, setHoveredCancel] = useState(null)
  const [autoModal, setAutoModal] = useState(false)
  const [selectedTeachers, setSelectedTeachers] = useState(new Set())
  const [autoScheduling, setAutoScheduling] = useState(false)
  const [autoResult, setAutoResult] = useState(null)

  // UI state for new design
  const [mainTab, setMainTab] = useState('book')
  const [pendingSlots, setPendingSlots] = useState(new Map()) // slotId -> childIdx
  const [cancelModal, setCancelModal] = useState(null) // { booking }
  const [confirming, setConfirming] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const [slotsData, bookingsData] = await Promise.all([getSlots(), getMyBookings()])
      setSlots(slotsData)
      setBookings(bookingsData)
    } catch {
      setError('Failed to load data')
    }
    setLoading(false)
  }

  const activeBookings = bookings.filter(b => b.status !== 'cancelled')
  const bookedSlotIds = new Set(activeBookings.map(b => b.slot_id))
  const slotToBookingId = Object.fromEntries(activeBookings.map(b => [b.slot_id, b.id]))

  const groupByTeacher = () => {
    const map = {}
    slots.forEach(s => {
      if (!map[s.teacher_name]) map[s.teacher_name] = []
      map[s.teacher_name].push(s)
    })
    return map
  }

  const handleBook = async (slot_id) => {
    try {
      await createBooking(slot_id)
      showToast('Booking confirmed!')
      fetchData()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Booking failed')
    }
  }

  const handleCancel = async (slot_id) => {
    const bookingId = slotToBookingId[slot_id]
    if (!bookingId) return
    try {
      await cancelBooking(bookingId)
      showToast('Booking cancelled')
      fetchData()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Cancel failed')
    }
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const openAutoModal = () => {
    setSelectedTeachers(new Set())
    setAutoResult(null)
    setAutoModal(true)
  }

  const toggleTeacher = (id) => {
    setSelectedTeachers(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAutoSchedule = async () => {
    setAutoScheduling(true)
    try {
      const result = await autoSchedule([...selectedTeachers])
      setAutoResult(result)
      fetchData()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Auto-schedule failed')
      setAutoModal(false)
    }
    setAutoScheduling(false)
  }

  const handleConfirmPending = async () => {
    setConfirming(true)
    for (const [slotId] of pendingSlots) {
      await handleBook(slotId)
    }
    setPendingSlots(new Map())
    setConfirming(false)
  }

  const teacherGroups = groupByTeacher()
  const teachers = Object.keys(teacherGroups)
  const teacherOptions = [...new Map(slots.map(s => [s.teacher_id, s.teacher_name])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const bookedCount = bookings.filter(b => b.status !== 'cancelled').length
  const allTimes = [...new Set(slots.map(s => s.start_time))].sort()

  const initials = user?.name ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'PM'
  const sortedActiveBookings = [...activeBookings].sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
  const childIdx = CHILDREN.indexOf(child)

  if (loading) return (
    <div style={{ minHeight: '100svh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: C.orange, fontSize: 13, fontWeight: 600 }}>Loading…</div>
    </div>
  )

  return (
    <div style={{ background: C.bg, minHeight: '100svh', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 'clamp(10px,1.5vw,18px)', overflow: 'hidden', width: 'min(96vw, 960px)', margin: 'clamp(10px,2vw,20px) auto', display: 'flex', flexDirection: 'column', height: 'calc(100svh - clamp(20px,4vw,40px))' }}>

        {/* Topbar */}
        <div style={{ padding: 'clamp(8px,1.2vw,14px) clamp(12px,2vw,22px)', background: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px,1.2vw,14px)' }}>
            <div style={{ width: 'clamp(28px,3.5vw,38px)', height: 'clamp(28px,3.5vw,38px)', borderRadius: '50%', background: 'rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(9px,1.1vw,12px)', fontWeight: 700, color: '#fff', border: '1.5px solid rgba(255,255,255,.5)', flexShrink: 0 }}>{initials}</div>
            <div>
              <div style={{ fontSize: 'clamp(12px,1.6vw,16px)', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{user?.name || 'Paras Mehta'}</div>
              <div style={{ fontSize: 'clamp(10px,1.2vw,12px)', color: 'rgba(255,255,255,.8)', lineHeight: 1.2 }}>Inventure Academy · PTM 09 Apr 2026</div>
            </div>
          </div>
          <button onClick={logoutUser} style={{ fontSize: 'clamp(10px,1.2vw,13px)', fontWeight: 600, padding: 'clamp(4px,.8vw,8px) clamp(10px,1.5vw,16px)', borderRadius: 20, background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Sign out</button>
        </div>

        {/* Main tabs */}
        <div style={{ display: 'flex', borderBottom: `2px solid ${C.border}`, flexShrink: 0 }}>
          {[['book', 'Book'], ['schedule', `My schedule (${bookedCount})`]].map(([key, lbl]) => (
            <div key={key} onClick={() => setMainTab(key)} style={{ flex: 1, padding: 'clamp(10px,1.4vw,14px)', textAlign: 'center', fontSize: 'clamp(12px,1.5vw,15px)', fontWeight: 600, cursor: 'pointer', color: mainTab === key ? C.orange : C.grey, borderBottom: `3px solid ${mainTab === key ? C.orange : 'transparent'}`, marginBottom: -2, background: mainTab === key ? C.bg : '#fff', transition: 'all .15s' }}>{lbl}</div>
          ))}
        </div>

        {mainTab === 'book' ? <>
          {/* Child selector bar */}
          <div style={{ background: C.bg, borderBottom: `1px solid ${C.border}`, padding: 'clamp(6px,1vw,10px) clamp(12px,1.8vw,20px)', display: 'flex', alignItems: 'center', gap: 'clamp(6px,1vw,10px)', overflowX: 'auto', flexShrink: 0 }}>
            {CHILDREN.map(c => {
              const active = child.name === c.name
              return (
                <button key={c.name} onClick={() => setChild(c)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 'clamp(6px,1vw,9px) clamp(12px,1.6vw,18px)', borderRadius: 50, border: `1.5px solid ${active ? c.color : C.border}`, background: active ? c.bg : '#fff', color: active ? c.textColor : C.grey, fontSize: 'clamp(11px,1.3vw,14px)', fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', transition: 'all .12s' }}>
                  {active && <span style={{ fontSize: 12 }}>✓</span>}
                  {c.label}
                </button>
              )
            })}
            <div style={{ flex: 1 }} />
            <button onClick={openAutoModal} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 'clamp(6px,1vw,9px) clamp(12px,1.6vw,18px)', borderRadius: 50, border: 'none', background: C.orange, color: '#fff', fontSize: 'clamp(11px,1.3vw,14px)', fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>✦ Auto-schedule</button>
          </div>

          {/* Booking grid */}
          <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', minWidth: `${72 + teachers.length * 72}px` }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ width: 'clamp(52px,7vw,72px)', background: C.bg, borderBottom: `3px solid ${C.orange}`, borderRight: `2px solid ${C.orange}`, padding: 'clamp(6px,1vw,10px) 6px', textAlign: 'left', fontSize: 'clamp(9px,1.1vw,11px)', fontWeight: 700, color: C.grey, position: 'sticky', left: 0, zIndex: 3 }}>Time</th>
                  {teachers.map(t => (
                    <th key={t} style={{ background: C.bg, borderBottom: `3px solid ${C.orange}`, padding: 'clamp(4px,.8vw,8px) 2px', textAlign: 'center', fontSize: 'clamp(8px,1vw,11px)', fontWeight: 700, color: C.navy, lineHeight: 1.3 }}>
                      <div>{t.split(' ')[0]}</div>
                      <div style={{ fontSize: 'clamp(7px,.9vw,10px)', fontWeight: 400, color: C.grey }}>{t.split(' ').slice(1).join(' ')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allTimes.map(time => (
                  <tr key={time}>
                    <td style={{ background: C.bg, borderRight: `2px solid ${C.orange}`, borderBottom: `1px solid ${C.border}`, padding: 'clamp(4px,.6vw,6px) clamp(4px,.8vw,8px)', fontSize: 'clamp(9px,1.1vw,12px)', color: C.grey, fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1 }}>
                      {fmt(time)}
                    </td>
                    {teachers.map(t => {
                      const slot = teacherGroups[t]?.find(s => s.start_time === time)
                      if (!slot) return <td key={t} style={{ borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, height: 'clamp(28px,3.5vw,38px)', background: '#FAFAFA' }} />
                      const isBooked = bookedSlotIds.has(slot.id)
                      const isPending = pendingSlots.has(slot.id)
                      const pendingChildIdx = pendingSlots.get(slot.id)
                      const isFull = slot.booked_count >= slot.capacity && !isBooked
                      return (
                        <td key={t} style={{ padding: 2, borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, height: 'clamp(28px,3.5vw,38px)' }}>
                          <button
                            onClick={() => {
                              if (isBooked) {
                                const bk = activeBookings.find(b => b.slot_id === slot.id)
                                if (bk) setCancelModal({ booking: bk })
                              } else if (isPending) {
                                setPendingSlots(prev => { const n = new Map(prev); n.delete(slot.id); return n })
                              } else if (!isFull) {
                                setPendingSlots(prev => new Map(prev).set(slot.id, childIdx))
                              }
                            }}
                            onMouseEnter={() => isBooked && setHoveredCancel(slot.id)}
                            onMouseLeave={() => setHoveredCancel(null)}
                            style={{
                              width: '100%', height: '100%', borderRadius: 4,
                              border: isBooked ? `1.5px solid ${C.orange}` : isPending ? `1.5px solid ${CHILDREN[pendingChildIdx]?.color || C.orange}` : 'none',
                              background: isBooked ? C.lightOrange : isPending ? (CHILDREN[pendingChildIdx]?.bg || C.lightOrange) : 'transparent',
                              color: isBooked ? '#C45A0A' : isPending ? (CHILDREN[pendingChildIdx]?.textColor || '#C45A0A') : isFull ? C.grey : C.grey,
                              fontSize: 'clamp(10px,1.2vw,13px)', fontWeight: isBooked || isPending ? 700 : 500,
                              cursor: isFull && !isBooked && !isPending ? 'default' : 'pointer',
                              transition: 'all .1s', fontFamily: 'inherit',
                            }}
                          >
                            {isBooked ? (hoveredCancel === slot.id ? '×' : '✓') : isPending ? '+' : isFull ? '—' : '+'}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend strip + bottom bar */}
          <div style={{ background: C.bg, borderTop: `1px solid ${C.border}`, padding: 'clamp(6px,1vw,10px) clamp(12px,1.8vw,20px)', display: 'flex', alignItems: 'center', gap: 'clamp(8px,1.2vw,16px)', flexShrink: 0, flexWrap: 'wrap' }}>
            {[['Parshv', C.lightOrange, C.orange], ['Dhriti', '#EFF6FF', '#2563EB'], ['Taken', '#F3F4F6', '#E5E7EB']].map(([lbl, bg, bdr]) => (
              <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1.5px solid ${bdr}`, flexShrink: 0 }} />
                <span style={{ fontSize: 'clamp(9px,1.1vw,12px)', color: C.grey }}>{lbl}</span>
              </div>
            ))}
            <div style={{ flex: 1 }} />
            {error && <span style={{ fontSize: 11, color: '#E24B4A' }}>{error}</span>}
            <span style={{ fontSize: 'clamp(11px,1.4vw,14px)', color: '#C45A0A', fontWeight: 500 }}>{pendingSlots.size > 0 ? `${pendingSlots.size} pending` : `${bookedCount} of ${teachers.length} booked`}</span>
            <button
              onClick={handleConfirmPending}
              disabled={pendingSlots.size === 0 || confirming}
              style={{ padding: 'clamp(7px,1vw,10px) clamp(14px,2vw,22px)', borderRadius: 50, border: 'none', background: pendingSlots.size === 0 ? C.border : C.orange, color: '#fff', fontSize: 'clamp(12px,1.4vw,15px)', fontWeight: 700, cursor: pendingSlots.size === 0 ? 'default' : 'pointer', fontFamily: 'inherit', opacity: pendingSlots.size === 0 ? .6 : 1, transition: 'all .15s' }}>
              {confirming ? 'Confirming…' : 'Confirm bookings'}
            </button>
          </div>
        </> : (
          /* My schedule tab */
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {sortedActiveBookings.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.grey, fontSize: 14 }}>No bookings yet. Go to the Book tab to schedule meetings.</div>
            ) : (
              sortedActiveBookings.map(bk => (
                <MeetingRow key={bk.id} booking={bk} onCancel={bk => setCancelModal({ booking: bk })} />
              ))
            )}
          </div>
        )}
      </div>

      {/* Cancel confirmation modal */}
      {cancelModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setCancelModal(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 'min(380px, calc(100vw - 32px))', boxShadow: '0 8px 32px rgba(0,0,0,.18)', padding: 'clamp(18px,2.5vw,28px)' }}>
            <div style={{ fontSize: 'clamp(15px,2vw,20px)', fontWeight: 800, color: C.navy, marginBottom: 6 }}>Cancel meeting?</div>
            <div style={{ fontSize: 'clamp(12px,1.4vw,15px)', color: C.grey, marginBottom: 'clamp(18px,2.5vw,26px)' }}>Cancel your meeting with {cancelModal.booking.teacher_name} at {fmt(cancelModal.booking.start_time)}?</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setCancelModal(null)} style={{ flex: 1, padding: 'clamp(10px,1.4vw,14px)', borderRadius: 10, border: `1.5px solid ${C.border}`, background: '#fff', color: C.grey, fontSize: 'clamp(13px,1.5vw,15px)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Keep</button>
              <button onClick={async () => { const slot_id = cancelModal.booking.slot_id; setCancelModal(null); await handleCancel(slot_id) }} style={{ flex: 1, padding: 'clamp(10px,1.4vw,14px)', borderRadius: 10, border: 'none', background: C.orange, color: '#fff', fontSize: 'clamp(13px,1.5vw,15px)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel meeting</button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-schedule modal */}
      {autoModal && (
        <div onClick={e => { if (e.target === e.currentTarget && !autoScheduling) setAutoModal(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 'min(380px, calc(100vw - 32px))', boxShadow: '0 8px 32px rgba(0,0,0,.18)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
            {autoResult === null ? (
              <>
                <div style={{ padding: 'clamp(14px,2vw,22px) clamp(16px,2.2vw,24px) clamp(10px,1.4vw,16px)', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 'clamp(15px,2vw,20px)', fontWeight: 800, color: C.navy }}>✦ Auto-schedule</div>
                  <div style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: C.grey, marginTop: 3 }}>Pick teachers — we'll find a conflict-free schedule</div>
                </div>
                <div style={{ padding: 'clamp(6px,1vw,10px) clamp(16px,2.2vw,24px)', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: C.grey }}>{selectedTeachers.size} of {teacherOptions.length} selected</span>
                  <button onClick={() => setSelectedTeachers(selectedTeachers.size === teacherOptions.length ? new Set() : new Set(teacherOptions.map(t => t.id)))} style={{ fontSize: 'clamp(11px,1.3vw,14px)', fontWeight: 700, color: C.orange, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{selectedTeachers.size === teacherOptions.length ? 'Deselect all' : 'Select all'}</button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {teacherOptions.map((t, i) => {
                    const checked = selectedTeachers.has(t.id)
                    const alreadyBooked = slots.some(s => s.teacher_id === t.id && bookedSlotIds.has(s.id))
                    return (
                      <div key={t.id} onClick={() => toggleTeacher(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'clamp(10px,1.4vw,14px) clamp(16px,2.2vw,24px)', cursor: 'pointer', borderBottom: i < teacherOptions.length - 1 ? `1px solid ${C.border}` : 'none', background: checked ? C.bg : '#fff', transition: 'background .1s' }}>
                        <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: checked ? `2px solid ${C.orange}` : `1.5px solid ${C.border}`, background: checked ? C.orange : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .1s' }}>
                          {checked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 'clamp(12px,1.5vw,15px)', fontWeight: 600, color: C.navy }}>{t.name}</div>
                          {alreadyBooked && <div style={{ fontSize: 'clamp(10px,1.1vw,12px)', color: C.orange, marginTop: 1 }}>Already booked</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ padding: 'clamp(12px,1.6vw,18px) clamp(16px,2.2vw,24px)', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10 }}>
                  <button onClick={() => setAutoModal(false)} style={{ flex: 1, padding: 'clamp(10px,1.4vw,13px)', fontSize: 'clamp(12px,1.5vw,15px)', fontWeight: 700, background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                  <button onClick={handleAutoSchedule} disabled={selectedTeachers.size === 0 || autoScheduling} style={{ flex: 2, padding: 'clamp(10px,1.4vw,13px)', fontSize: 'clamp(12px,1.5vw,15px)', fontWeight: 700, background: selectedTeachers.size === 0 || autoScheduling ? C.border : C.orange, color: '#fff', border: 'none', borderRadius: 10, cursor: selectedTeachers.size === 0 || autoScheduling ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'background .15s' }}>
                    {autoScheduling ? 'Scheduling…' : `Schedule ${selectedTeachers.size > 0 ? selectedTeachers.size : ''} meeting${selectedTeachers.size !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ padding: 'clamp(18px,2.5vw,28px) clamp(16px,2.2vw,24px) clamp(12px,1.6vw,18px)', textAlign: 'center', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', margin: '0 auto 10px', background: autoResult.booked.length > 0 ? C.lightOrange : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: autoResult.booked.length > 0 ? '#C45A0A' : C.grey }}>
                    {autoResult.booked.length > 0 ? '✓' : '—'}
                  </div>
                  <div style={{ fontSize: 'clamp(15px,2vw,20px)', fontWeight: 800, color: C.navy }}>{autoResult.booked.length > 0 ? `Scheduled ${autoResult.booked.length} meeting${autoResult.booked.length !== 1 ? 's' : ''}` : 'No slots available'}</div>
                  {autoResult.conflicts.length > 0 && <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: C.grey, marginTop: 4 }}>{autoResult.conflicts.length} teacher{autoResult.conflicts.length !== 1 ? 's' : ''} couldn't be scheduled</div>}
                </div>
                <div style={{ overflowY: 'auto', flex: 1, padding: 'clamp(10px,1.4vw,16px) clamp(16px,2.2vw,24px)' }}>
                  {autoResult.booked.map((b, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < autoResult.booked.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.orange, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 'clamp(12px,1.5vw,15px)', fontWeight: 700, color: C.navy }}>{b.teacher_name}</div>
                        <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: C.grey, marginTop: 1 }}>{fmt(b.start_time)} – {fmt(b.end_time)}</div>
                      </div>
                      <div style={{ fontSize: 'clamp(9px,1.1vw,12px)', fontWeight: 700, color: '#C45A0A', background: C.lightOrange, padding: '2px 8px', borderRadius: 20 }}>Confirmed</div>
                    </div>
                  ))}
                  {autoResult.conflicts.length > 0 && (
                    <div style={{ marginTop: autoResult.booked.length > 0 ? 14 : 0, background: '#F9FAFB', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ fontSize: 'clamp(9px,1.1vw,12px)', fontWeight: 700, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Could not schedule</div>
                      {autoResult.conflicts.map((name, i) => (
                        <div key={i} style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: '#6B7280', padding: '4px 0', borderBottom: i < autoResult.conflicts.length - 1 ? '1px solid #E5E7EB' : 'none' }}>{name}</div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ padding: 'clamp(12px,1.6vw,18px) clamp(16px,2.2vw,24px)', borderTop: `1px solid ${C.border}` }}>
                  <button onClick={() => setAutoModal(false)} style={{ width: '100%', padding: 'clamp(10px,1.4vw,14px)', fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 700, background: C.orange, color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }}>Done</button>
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
