import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' })
api.interceptors.request.use(cfg => { const t = localStorage.getItem('token'); if (t) cfg.headers.Authorization = `Bearer ${t}`; return cfg })
const getMySlots = () => api.get('/slots/mine').then(r => r.data)
const createSlot = body => api.post('/slots/', body).then(r => r.data)

const fmt = iso => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
const initials = name => { if (!name) return '??'; const p = name.split(' ').filter(Boolean); return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0].substring(0, 2).toUpperCase() }
const clock = () => { const n = new Date(); let h = n.getHours(); const m = n.getMinutes(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${m < 10 ? '0' : ''}${m} ${ap}` }

const FAINT_TICK = <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#F4C099" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
const DONE_TICK = <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#F47920" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>

export default function TeacherDashboard() {
  const { user, logoutUser } = useAuth()
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('s') // 's' = my schedule, 'p' = past, 'm' = manage
  const [toast, setToast] = useState('')
  const [time, setTime] = useState(clock())
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [venueModal, setVenueModal] = useState(false)
  const [venueText, setVenueText] = useState(user?.venue || 'Room TBD')
  const [venueInput, setVenueInput] = useState('')
  const [cancelModal, setCancelModal] = useState(null)
  const [done, setDone] = useState({})
  const [addSlotOpen, setAddSlotOpen] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [newCap, setNewCap] = useState(1)
  const [creating, setCreating] = useState(false)

  useEffect(() => { fetchData() }, [])
  useEffect(() => { const t = setInterval(() => setTime(clock()), 1000); return () => clearInterval(t) }, [])

  const fetchData = async () => {
    setLoading(true)
    try { const d = await getMySlots(); setSlots(d) }
    catch { showToast('Failed to load slots') }
    setLoading(false)
  }

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const userInitials = user?.name ? user.name.replace(/^(Ms\.|Mr\.|Dr\.)/, '').trim().split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'T'
  const bookedCount = slots.filter(s => s.booked_count > 0).length
  const freeCount = slots.length - bookedCount
  const fillRate = slots.length > 0 ? Math.round((bookedCount / slots.length) * 100) : 0

  // For demo: treat slots as upcoming/past based on index
  const upcomingSlots = slots
  const pastSlots = []

  const createNewSlot = async () => {
    if (!newDate || !newStart || !newEnd) { showToast('Fill in all fields'); return }
    setCreating(true)
    try { await createSlot({ start_time: `${newDate}T${newStart}:00`, end_time: `${newDate}T${newEnd}:00`, capacity: newCap }); showToast('Slot created!'); fetchData(); setAddSlotOpen(false) }
    catch (err) { showToast(err.response?.data?.detail || 'Failed to create slot') }
    setCreating(false)
  }

  const inpStyle = { width: '100%', padding: 'clamp(10px,1.4vw,14px) clamp(12px,1.6vw,16px)', border: '1.5px solid #F4C099', borderRadius: 10, fontSize: 'clamp(13px,1.5vw,15px)', fontFamily: 'inherit', color: '#1B3F7A', background: '#fff', outline: 'none', boxSizing: 'border-box' }
  const lblStyle = { fontSize: 'clamp(11px,1.2vw,13px)', fontWeight: 700, color: '#C45A0A', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4, display: 'block' }

  return (
    <div style={{ background: '#FFF8F3', minHeight: '100svh', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif", WebkitFontSmoothing: 'antialiased' }}>
      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', width: 'min(96vw,900px)', margin: 'clamp(10px,2vw,20px) auto', boxShadow: '0 2px 20px rgba(0,0,0,.06)', display: 'flex', flexDirection: 'column', height: 'calc(100svh - clamp(20px,4vw,40px))' }}>

        {/* TOPBAR */}
        <div style={{ background: '#F47920', padding: 'clamp(10px,1.8vw,20px) clamp(14px,2.5vw,28px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px,1.5vw,16px)', flex: 1, minWidth: 0 }}>
            <div style={{ width: 'clamp(34px,4.5vw,48px)', height: 'clamp(34px,4.5vw,48px)', borderRadius: '50%', background: 'rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(12px,1.6vw,17px)', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{userInitials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'clamp(14px,2vw,22px)', fontWeight: 700, color: '#fff', letterSpacing: '-.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Teacher'}</div>
              <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: 'rgba(255,255,255,.8)', marginTop: 2 }}>PTM 09 Apr 2026</div>
              <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: 'rgba(255,255,255,.8)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{venueText}</span>
                <button onClick={() => { setVenueInput(venueText); setVenueModal(true) }} style={{ fontSize: 'clamp(9px,1.1vw,12px)', padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit' }}>Change venue</button>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px,1.2vw,14px)', flexShrink: 0 }}>
            <div style={{ fontSize: 'clamp(12px,1.6vw,18px)', fontWeight: 700, background: '#fff', color: '#F47920', padding: 'clamp(4px,.8vw,9px) clamp(8px,1.4vw,16px)', borderRadius: 8, whiteSpace: 'nowrap' }}>{time}</div>
            <button onClick={logoutUser} style={{ fontSize: 'clamp(10px,1.2vw,13px)', fontWeight: 600, padding: 'clamp(4px,.8vw,8px) clamp(10px,1.5vw,16px)', borderRadius: 20, background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
          </div>
        </div>

        {/* NEXT BANNER */}
        {upcomingSlots.length > 0 && (
          <div style={{ background: '#FFF0E6', borderBottom: '1px solid #F4C099', padding: 'clamp(8px,1.2vw,14px) clamp(16px,2.5vw,28px)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 'clamp(12px,1.5vw,16px)', fontWeight: 700, color: '#C45A0A', whiteSpace: 'nowrap' }}>Up next:</span>
            <span style={{ fontSize: 'clamp(12px,1.5vw,16px)', fontWeight: 600, color: '#1B3F7A' }}>
              {upcomingSlots[0]?.bookings?.length > 0 ? upcomingSlots[0].bookings[0].parent_name : 'No upcoming'} at {fmt(upcomingSlots[0]?.start_time)}
            </span>
          </div>
        )}

        {/* TABS */}
        <div style={{ display: 'flex', background: '#fff', borderBottom: '2px solid #F4C099', flexShrink: 0 }}>
          {[['s', 'My schedule'], ['p', 'Past meetings'], ['m', 'Manage slots']].map(([key, lbl]) => (
            <div key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: 'clamp(12px,1.8vw,18px) 8px', textAlign: 'center', fontSize: 'clamp(13px,1.6vw,17px)', fontWeight: 600, cursor: 'pointer', color: tab === key ? '#F47920' : '#C4B5A5', borderBottom: tab === key ? '3px solid #F47920' : '3px solid transparent', marginBottom: -2, transition: 'all .2s' }}>{lbl}</div>
          ))}
        </div>

        {/* MY SCHEDULE */}
        {tab === 's' && <>
          <div style={{ padding: 'clamp(10px,1.4vw,16px) clamp(16px,2.5vw,28px)', borderBottom: '1px solid #F4C099', background: '#FFF8F3', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, flexShrink: 0, minHeight: 'clamp(44px,5.5vw,58px)' }}>
            <span style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#9CA3AF', fontWeight: 500 }}>{upcomingSlots.length} meetings</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => showToast('Exporting PDF...')} style={{ fontSize: 'clamp(11px,1.4vw,15px)', fontWeight: 600, padding: 'clamp(6px,.9vw,10px) clamp(12px,1.6vw,18px)', borderRadius: 50, background: '#fff', color: '#F47920', border: '1.5px solid #F4C099', cursor: 'pointer', fontFamily: 'inherit' }}>Export PDF</button>
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
            ) : upcomingSlots.length === 0 ? (
              <div style={{ padding: 'clamp(32px,5vw,60px)', textAlign: 'center', color: '#C4B5A5', fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 500 }}>No upcoming meetings</div>
            ) : upcomingSlots.map((slot, i) => {
              const bkName = slot.bookings?.length > 0 ? slot.bookings[0].parent_name : null
              const isDone = done[slot.id]
              return (
                <div key={slot.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #F4EDE4', minHeight: 'clamp(68px,9vw,88px)', background: isDone ? '#FAFAFA' : '#fff' }}>
                  <div style={{ width: 'clamp(60px,8vw,80px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px', flexShrink: 0 }}>
                    <div style={{ fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 700, color: isDone ? '#C4B5A5' : '#1B3F7A', letterSpacing: '-.02em' }}>{fmt(slot.start_time)}</div>
                  </div>
                  <div style={{ width: 3, flexShrink: 0, alignSelf: 'stretch', background: isDone ? '#E5E5E5' : '#F4C099' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px,1.4vw,14px)', flex: 1, padding: 'clamp(10px,1.4vw,14px) clamp(14px,2vw,18px)', minWidth: 0 }}>
                    <div style={{ width: 'clamp(36px,4.5vw,48px)', height: 'clamp(36px,4.5vw,48px)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(12px,1.5vw,17px)', fontWeight: 700, flexShrink: 0, background: '#fff', border: '2px solid #F4C099', color: '#F47920', opacity: isDone ? .4 : 1 }}>{bkName ? initials(bkName) : '—'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 700, color: isDone ? '#C4B5A5' : '#1B3F7A', letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: isDone ? 'line-through' : 'none' }}>{bkName || '(free)'}</div>
                      <div style={{ fontSize: 'clamp(11px,1.3vw,15px)', color: '#9CA3AF', marginTop: 2 }}>{slot.bookings?.length > 0 ? slot.bookings[0].student_name || '' : `${slot.booked_count}/${slot.capacity} booked`}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px,1.5vw,16px)', paddingRight: 'clamp(14px,2vw,22px)', flexShrink: 0 }}>
                    <div onClick={() => setDone(p => ({ ...p, [slot.id]: !p[slot.id] }))} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ width: 'clamp(22px,2.8vw,30px)', height: 'clamp(22px,2.8vw,30px)', borderRadius: 6, border: `2px solid ${isDone ? '#F47920' : '#F4C099'}`, background: isDone ? '#FFF0E6' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', flexShrink: 0 }}>
                        {isDone ? DONE_TICK : FAINT_TICK}
                      </div>
                    </div>
                    {bkName && <button onClick={() => setCancelModal({ id: slot.id, name: bkName })} onMouseEnter={e => e.currentTarget.style.color = '#F47920'} onMouseLeave={e => e.currentTarget.style.color = '#C4B5A5'} style={{ width: 'clamp(28px,3.5vw,38px)', height: 'clamp(28px,3.5vw,38px)', borderRadius: 8, background: '#fff', border: 'none', color: '#C4B5A5', cursor: 'pointer', fontSize: 'clamp(18px,2.2vw,26px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 300, lineHeight: 1, padding: 0 }}>×</button>}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ padding: 'clamp(12px,1.8vw,18px) clamp(16px,2.5vw,28px)', borderTop: '1px solid #F4C099', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF8F3', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#C45A0A', fontWeight: 600 }}>{Object.values(done).filter(Boolean).length} done</span>
          </div>
        </>}

        {/* PAST */}
        {tab === 'p' && <>
          <div style={{ padding: 'clamp(10px,1.4vw,16px) clamp(16px,2.5vw,28px)', borderBottom: '1px solid #F4C099', background: '#FFF8F3', flexShrink: 0 }}>
            <span style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#9CA3AF', fontWeight: 500 }}>Past meetings</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <div style={{ padding: 'clamp(32px,5vw,60px)', textAlign: 'center', color: '#C4B5A5', fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 500 }}>No past meetings yet</div>
          </div>
        </>}

        {/* MANAGE SLOTS */}
        {tab === 'm' && <>
          <div style={{ padding: 'clamp(8px,1.2vw,14px) clamp(16px,2.5vw,28px)', borderBottom: '1px solid #F4C099', background: '#FFF8F3', display: 'flex', gap: 'clamp(12px,2vw,24px)', flexWrap: 'wrap', flexShrink: 0 }}>
            <span style={{ fontSize: 'clamp(12px,1.4vw,15px)', fontWeight: 600, color: '#C45A0A' }}>{bookedCount} booked</span>
            <span style={{ fontSize: 'clamp(12px,1.4vw,15px)', fontWeight: 600, color: '#9CA3AF' }}>{freeCount} free</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div> : slots.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#C4B5A5', fontSize: 'clamp(14px,1.8vw,20px)' }}>No slots yet</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                  <tr>
                    {['Time', 'Status', 'Parent', 'Student'].map((h, i) => (
                      <th key={i} style={{ fontSize: 'clamp(12px,1.5vw,16px)', fontWeight: 700, color: '#1B3F7A', padding: 'clamp(10px,1.4vw,16px) 4px', textAlign: 'center', borderBottom: '2px solid #F47920', borderRight: i < 3 ? '1px solid #F4C099' : 'none', background: '#FFF8F3', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slots.map(slot => {
                    const bk = slot.bookings?.length > 0 ? slot.bookings[0] : null
                    const state = bk ? 'booked' : 'free'
                    return (
                      <tr key={slot.id} onClick={() => setSelectedSlot(selectedSlot?.id === slot.id ? null : slot)} style={{ cursor: 'pointer', background: selectedSlot?.id === slot.id ? '#EFF6FF' : '#fff', transition: 'background .1s' }}>
                        <td style={{ padding: 'clamp(8px,1.2vw,12px) clamp(8px,1.2vw,14px)', borderRight: '1px solid #FDE9D4', borderBottom: '1px solid #FDE9D4' }}>
                          <div style={{ borderRadius: 10, padding: 'clamp(8px,1.2vw,12px) clamp(8px,1.2vw,14px)', background: state === 'booked' ? '#FFF0E6' : '#F9FAFB', border: `1.5px solid ${state === 'booked' ? '#F4C099' : '#E5E7EB'}`, minHeight: 'clamp(56px,7.5vw,76px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div style={{ fontSize: 'clamp(11px,1.3vw,14px)', fontWeight: 700, color: '#1B3F7A' }}>{fmt(slot.start_time)}</div>
                            <div style={{ fontSize: 'clamp(9px,1.1vw,12px)', color: '#9CA3AF', marginTop: 3, fontStyle: 'italic' }}>{state === 'booked' ? `${slot.booked_count}/${slot.capacity}` : 'Free'}</div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', borderRight: '1px solid #FDE9D4', borderBottom: '1px solid #FDE9D4', padding: 4 }}>
                          <span style={{ fontSize: 'clamp(10px,1.2vw,13px)', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: state === 'booked' ? '#FFF0E6' : '#F9FAFB', color: state === 'booked' ? '#C45A0A' : '#9CA3AF', border: `1px solid ${state === 'booked' ? '#F4C099' : '#E5E7EB'}` }}>{state === 'booked' ? 'Booked' : 'Free'}</span>
                        </td>
                        <td style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: '#C45A0A', fontWeight: 600, padding: 'clamp(8px,1.2vw,12px) 4px', borderRight: '1px solid #FDE9D4', borderBottom: '1px solid #FDE9D4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bk?.parent_name || '—'}</td>
                        <td style={{ fontSize: 'clamp(9px,1.1vw,12px)', color: '#9CA3AF', padding: 'clamp(8px,1.2vw,12px) 4px', borderBottom: '1px solid #FDE9D4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bk?.student_name || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          {/* Drawer */}
          <div style={{ borderTop: '1.5px solid #F4C099', background: '#FFF8F3', padding: 'clamp(12px,1.8vw,20px) clamp(16px,2.5vw,28px)', flexShrink: 0 }}>
            {selectedSlot ? (
              <>
                <div style={{ fontSize: 'clamp(13px,1.6vw,18px)', fontWeight: 700, color: '#1B3F7A', marginBottom: 'clamp(10px,1.4vw,16px)', letterSpacing: '-.01em' }}>{fmt(selectedSlot.start_time)}{selectedSlot.bookings?.length > 0 ? ` — ${selectedSlot.bookings[0].parent_name}` : ''}</div>
                <div style={{ display: 'flex', gap: 'clamp(8px,1.2vw,14px)', flexWrap: 'wrap' }}>
                  {selectedSlot.bookings?.length > 0 && <button onClick={() => { showToast('Booking cancelled'); setSelectedSlot(null) }} style={{ fontSize: 'clamp(13px,1.6vw,17px)', padding: 'clamp(9px,1.3vw,14px) clamp(16px,2.2vw,26px)', borderRadius: 50, cursor: 'pointer', fontWeight: 600, border: '1.5px solid #F4C099', background: '#fff', color: '#1B3F7A', fontFamily: 'inherit' }}>Cancel booking</button>}
                  <button onClick={() => { showToast('Slot blocked'); setSelectedSlot(null) }} style={{ fontSize: 'clamp(13px,1.6vw,17px)', padding: 'clamp(9px,1.3vw,14px) clamp(16px,2.2vw,26px)', borderRadius: 50, cursor: 'pointer', fontWeight: 600, border: '1.5px solid #F4C099', background: '#fff', color: '#1B3F7A', fontFamily: 'inherit' }}>Block slot</button>
                  <button onClick={() => setSelectedSlot(null)} style={{ fontSize: 'clamp(13px,1.6vw,17px)', padding: 'clamp(9px,1.3vw,14px) clamp(16px,2.2vw,26px)', borderRadius: 50, cursor: 'pointer', fontWeight: 600, border: '1.5px solid #F4C099', background: '#fff', color: '#9CA3AF', fontFamily: 'inherit' }}>Dismiss</button>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 'clamp(12px,1.5vw,16px)', color: '#C4B5A5', fontWeight: 500, textAlign: 'center' }}>Tap any slot to manage it</div>
            )}
          </div>
          <div style={{ padding: 'clamp(12px,1.8vw,18px) clamp(16px,2.5vw,28px)', borderTop: '1px solid #F4C099', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF8F3', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#C45A0A', fontWeight: 600 }}>{bookedCount} of {slots.length} slots booked</span>
            <button onClick={() => setAddSlotOpen(true)} style={{ fontSize: 'clamp(11px,1.4vw,15px)', fontWeight: 600, padding: 'clamp(6px,.9vw,10px) clamp(12px,1.6vw,18px)', borderRadius: 50, background: '#fff', color: '#F47920', border: '1.5px solid #F4C099', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add slot</button>
          </div>
        </>}
      </div>

      {/* VENUE MODAL */}
      {venueModal && (
        <div onClick={() => setVenueModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20, backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 'clamp(24px,3.5vw,40px)', width: '100%', maxWidth: 'min(380px,calc(100vw - 32px))', boxShadow: '0 12px 40px rgba(0,0,0,.15)' }}>
            <div style={{ fontSize: 'clamp(17px,2.2vw,24px)', fontWeight: 700, color: '#1B3F7A', marginBottom: 8 }}>Change venue</div>
            <div style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#9CA3AF', marginBottom: 'clamp(10px,1.4vw,16px)', lineHeight: 1.5 }}>Enter the new room or location</div>
            <input value={venueInput} onChange={e => setVenueInput(e.target.value)} placeholder="e.g. Room 201" style={{ ...inpStyle, marginBottom: 'clamp(16px,2.5vw,24px)' }} onFocus={e => e.target.style.borderColor = '#F47920'} onBlur={e => e.target.style.borderColor = '#F4C099'} />
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setVenueModal(false)} style={{ flex: 1, padding: 'clamp(12px,1.6vw,16px)', borderRadius: 12, fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 700, cursor: 'pointer', border: '2px solid #F4C099', background: '#fff', color: '#9CA3AF', fontFamily: 'inherit' }}>Back</button>
              <button onClick={() => { if (venueInput.trim()) { setVenueText(venueInput.trim()); showToast('Venue updated to ' + venueInput.trim()) } setVenueModal(false) }} style={{ flex: 1, padding: 'clamp(12px,1.6vw,16px)', borderRadius: 12, fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 700, cursor: 'pointer', border: 'none', background: '#F47920', color: '#fff', fontFamily: 'inherit' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {cancelModal && (
        <div onClick={() => setCancelModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20, backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 'clamp(24px,3.5vw,40px)', width: '100%', maxWidth: 'min(380px,calc(100vw - 32px))', textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,.15)' }}>
            <div style={{ fontSize: 'clamp(17px,2.2vw,24px)', fontWeight: 700, color: '#1B3F7A', marginBottom: 8 }}>Cancel this meeting?</div>
            <div style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#9CA3AF', marginBottom: 'clamp(20px,3vw,30px)', lineHeight: 1.5 }}>Cancel meeting with {cancelModal.name}?</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setCancelModal(null)} style={{ flex: 1, padding: 'clamp(12px,1.6vw,16px)', borderRadius: 12, fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 700, cursor: 'pointer', border: '2px solid #F4C099', background: '#fff', color: '#9CA3AF', fontFamily: 'inherit' }}>Back</button>
              <button onClick={() => { showToast('Meeting cancelled'); setCancelModal(null) }} style={{ flex: 1, padding: 'clamp(12px,1.6vw,16px)', borderRadius: 12, fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 700, cursor: 'pointer', border: 'none', background: '#F47920', color: '#fff', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD SLOT DRAWER */}
      <div onClick={() => setAddSlotOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', opacity: addSlotOpen ? 1 : 0, pointerEvents: addSlotOpen ? 'all' : 'none', transition: 'opacity .25s', zIndex: 100 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '20px 20px 0 0', padding: 'clamp(20px,3vw,32px)', transform: addSlotOpen ? 'translateY(0)' : 'translateY(100%)', transition: 'transform .3s cubic-bezier(.4,0,.2,1)', zIndex: 101, boxShadow: '0 -8px 40px rgba(0,0,0,.12)', maxWidth: 500, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'clamp(16px,2vw,24px)' }}>
          <span style={{ fontSize: 'clamp(15px,1.8vw,20px)', fontWeight: 700, color: '#1B3F7A' }}>Add New Slot</span>
          <button onClick={() => setAddSlotOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lblStyle}>Date</label><input type="date" style={inpStyle} value={newDate} onChange={e => setNewDate(e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lblStyle}>Start</label><input type="time" style={inpStyle} value={newStart} onChange={e => setNewStart(e.target.value)} /></div>
            <div><label style={lblStyle}>End</label><input type="time" style={inpStyle} value={newEnd} onChange={e => setNewEnd(e.target.value)} /></div>
          </div>
          <div><label style={lblStyle}>Capacity</label>
            <select style={inpStyle} value={newCap} onChange={e => setNewCap(Number(e.target.value))}>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} parent{n>1?'s':''}</option>)}
            </select>
          </div>
          <button onClick={createNewSlot} disabled={creating} style={{ background: '#F47920', color: '#fff', border: 'none', borderRadius: 10, padding: 'clamp(10px,1.5vw,14px)', fontSize: 'clamp(13px,1.5vw,16px)', fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? .7 : 1, fontFamily: 'inherit', marginTop: 4 }}>
            {creating ? 'Creating…' : 'Create Slot'}
          </button>
        </div>
      </div>

      {/* TOAST */}
      <div style={{ position: 'fixed', bottom: 'clamp(16px,2.5vw,28px)', left: '50%', transform: 'translateX(-50%)', background: '#1B3F7A', color: '#fff', padding: 'clamp(10px,1.4vw,16px) clamp(18px,2.5vw,28px)', borderRadius: 50, fontSize: 'clamp(13px,1.6vw,17px)', fontWeight: 600, opacity: toast ? 1 : 0, transition: 'opacity .3s', pointerEvents: 'none', zIndex: 999, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(27,63,122,.3)', maxWidth: 'calc(100vw - 32px)', textAlign: 'center' }}>{toast}</div>
    </div>
  )
}
