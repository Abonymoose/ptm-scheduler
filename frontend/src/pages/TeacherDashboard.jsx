import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import { LOGO_SMALL } from '../assets/logos'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' })
api.interceptors.request.use(cfg => { const t = localStorage.getItem('token'); if (t) cfg.headers.Authorization = `Bearer ${t}`; return cfg })
const getMySlots = () => api.get('/slots/mine').then(r => r.data)
const createSlot = body => api.post('/slots/', body).then(r => r.data)

const fmt = iso => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
const clock = () => { const n = new Date(); let h = n.getHours(); const m = n.getMinutes(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${m < 10 ? '0' : ''}${m} ${ap}` }
const initials = name => { if (!name) return '??'; const p = name.replace(/^(Ms\.|Mr\.|Dr\.)/,'').trim().split(' ').filter(Boolean); return p.length >= 2 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : p[0].slice(0,2).toUpperCase() }

const DONE_TICK = <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#F47920" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>

function Toast({ msg }) {
  return <div style={{ position: 'fixed', bottom: 'clamp(16px,2.5vw,28px)', left: '50%', transform: 'translateX(-50%)', background: '#1B3F7A', color: '#fff', padding: 'clamp(10px,1.4vw,16px) clamp(18px,2.5vw,28px)', borderRadius: 50, fontSize: 'clamp(13px,1.6vw,17px)', fontWeight: 600, opacity: msg ? 1 : 0, transition: 'opacity .3s', pointerEvents: 'none', zIndex: 999, whiteSpace: 'nowrap', maxWidth: 'calc(100vw - 32px)', textAlign: 'center' }}>{msg}</div>
}

export default function TeacherDashboard() {
  const { user, logoutUser } = useAuth()
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('s')
  const [toast, setToast] = useState('')
  const [time, setTime] = useState(clock())
  const [done, setDone] = useState({})
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [venueModal, setVenueModal] = useState(false)
  const [venueText, setVenueText] = useState('Room TBD')
  const [venueInput, setVenueInput] = useState('')
  const [cancelModal, setCancelModal] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [newCap, setNewCap] = useState(1)
  const [creating, setCreating] = useState(false)
  const [hlNext, setHlNext] = useState(true)

  useEffect(() => { fetchData() }, [])
  useEffect(() => { const t = setInterval(() => setTime(clock()), 1000); return () => clearInterval(t) }, [])

  const fetchData = async () => {
    setLoading(true)
    try { const d = await getMySlots(); setSlots(d) }
    catch { showToast('Failed to load slots') }
    setLoading(false)
  }

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const userInitials = user?.name ? user.name.replace(/^(Ms\.|Mr\.|Dr\.)/,'').trim().split(' ').filter(Boolean).map(w => w[0]).join('').slice(0,2).toUpperCase() : 'T'
  const breakSlots = slots.filter(s => s.is_break || s.type === 'break')
  const bookedSlots = slots.filter(s => s.booked_count > 0)
  const freeSlots = slots.filter(s => s.booked_count === 0 && !s.is_break && s.type !== 'break')
  const doneCount = Object.values(done).filter(Boolean).length

  const upcomingSlots = slots.filter(s => s.booked_count > 0)
  const pastSlots = []

  // band grouping for manage tab
  const bandLabel = h => { const h1=h%12||12; const h2=(h+1)%12||12; const s1=h<12?'am':'pm'; const s2=(h+1)<12?'am':'pm'; return s1===s2?`${h1}–${h2}${s1}`:`${h1}${s1}–${h2}${s2}` }
  const bands = []
  const hours = [...new Set(slots.map(s => new Date(s.start_time).getHours()))].sort((a,b)=>a-b)
  hours.forEach(h => {
    const group = slots.filter(s => new Date(s.start_time).getHours() === h)
    bands.push({ label: bandLabel(h), slots: group })
  })

  const createNewSlot = async () => {
    if (!newDate || !newStart || !newEnd) { showToast('Fill in all fields'); return }
    setCreating(true)
    try { await createSlot({ start_time: `${newDate}T${newStart}:00`, end_time: `${newDate}T${newEnd}:00`, capacity: newCap }); showToast('Slot created!'); fetchData(); setAddOpen(false) }
    catch (err) { showToast(err.response?.data?.detail || 'Failed to create slot') }
    setCreating(false)
  }

  const inp = { width: '100%', padding: 'clamp(10px,1.4vw,14px) clamp(12px,1.6vw,16px)', border: '1.5px solid #F4C099', borderRadius: 10, fontSize: 'clamp(13px,1.5vw,15px)', fontFamily: 'inherit', color: '#1B3F7A', background: '#fff', outline: 'none', boxSizing: 'border-box' }
  const lbl = { fontSize: 'clamp(11px,1.2vw,13px)', fontWeight: 700, color: '#C45A0A', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4, display: 'block' }

  return (
    <div style={{ background: '#FFF8F3', minHeight: '100svh', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif", WebkitFontSmoothing: 'antialiased' }}>
      <style>{`.no-scroll::-webkit-scrollbar { display: none }`}</style>
      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', width: 'min(96vw,900px)', margin: 'clamp(10px,2vw,20px) auto', boxShadow: '0 2px 20px rgba(0,0,0,.06)', display: 'flex', flexDirection: 'column', height: 'calc(100svh - clamp(20px,4vw,40px))' }}>

        {/* TOPBAR */}
        <div style={{ background: '#F47920', padding: 'clamp(10px,1.8vw,20px) clamp(14px,2.5vw,28px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, flexShrink: 0, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px,1.5vw,16px)', flex: 1, minWidth: 0 }}>
            <div style={{ width: 'clamp(34px,4.5vw,48px)', height: 'clamp(34px,4.5vw,48px)', borderRadius: '50%', background: 'rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(12px,1.6vw,17px)', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{userInitials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'clamp(14px,2vw,22px)', fontWeight: 700, color: '#fff', letterSpacing: '-.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Teacher'}</div>
              <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: 'rgba(255,255,255,.8)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>PTM 09 Apr 2026</div>
              <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: 'rgba(255,255,255,.8)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span id="venue-text">{venueText}</span>
                <button onClick={() => { setVenueInput(venueText); setVenueModal(true) }} style={{ fontSize: 'clamp(9px,1.1vw,12px)', padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit' }}>Change venue</button>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px,1.2vw,14px)', flexShrink: 0 }}>
            <div style={{ fontSize: 'clamp(12px,1.6vw,18px)', fontWeight: 700, background: '#fff', color: '#F47920', padding: 'clamp(4px,.8vw,9px) clamp(8px,1.4vw,16px)', borderRadius: 8, whiteSpace: 'nowrap' }}>{time}</div>
            <img src={LOGO_SMALL} alt="Inventure" style={{ height: 'clamp(20px,2.8vw,34px)', width: 'auto', filter: 'brightness(0) invert(1)', opacity: .9 }} />
          </div>
        </div>

        {/* UP NEXT BANNER */}
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
          {[['s','My schedule'],['p','Past meetings'],['m','Manage slots']].map(([key, lbl]) => (
            <div key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: 'clamp(12px,1.8vw,18px) 8px', textAlign: 'center', fontSize: 'clamp(13px,1.6vw,17px)', fontWeight: 600, cursor: 'pointer', color: tab === key ? '#F47920' : '#C4B5A5', borderBottom: `3px solid ${tab === key ? '#F47920' : 'transparent'}`, marginBottom: -2, transition: 'all .2s', letterSpacing: '-.01em' }}>{lbl}</div>
          ))}
        </div>

        {/* MY SCHEDULE */}
        {tab === 's' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ padding: 'clamp(10px,1.4vw,16px) clamp(16px,2.5vw,28px)', borderBottom: '1px solid #F4C099', background: '#FFF8F3', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, flexShrink: 0, minHeight: 'clamp(44px,5.5vw,58px)' }}>
              <span style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#9CA3AF', fontWeight: 500 }}>{doneCount} of {upcomingSlots.length} done</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'clamp(12px,1.4vw,16px)', color: '#9CA3AF', fontWeight: 500 }}>
                  <span>Highlight next</span>
                  <label style={{ position: 'relative', width: 'clamp(36px,4.5vw,46px)', height: 'clamp(20px,2.5vw,26px)', cursor: 'pointer', flexShrink: 0 }}>
                    <input type="checkbox" checked={hlNext} onChange={e => setHlNext(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                    <span style={{ position: 'absolute', inset: 0, background: hlNext ? '#F47920' : '#E5D5C5', borderRadius: 20, transition: '.2s' }}>
                      <span style={{ position: 'absolute', height: 'calc(100% - 4px)', aspectRatio: 1, left: hlNext ? 'calc(100% - 2px)' : 2, bottom: 2, background: '#fff', borderRadius: '50%', transition: '.2s', boxShadow: '0 1px 4px rgba(0,0,0,.15)', transform: hlNext ? 'translateX(-100%)' : 'none' }} />
                    </span>
                  </label>
                </div>
                <button onClick={() => showToast('Exporting PDF...')} style={{ fontSize: 'clamp(11px,1.4vw,15px)', fontWeight: 600, padding: 'clamp(6px,.9vw,10px) clamp(12px,1.6vw,18px)', borderRadius: 50, background: '#fff', color: '#F47920', border: '1.5px solid #F4C099', cursor: 'pointer', fontFamily: 'inherit' }}>Export PDF</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
              : upcomingSlots.length === 0 ? <div style={{ padding: 'clamp(32px,5vw,60px)', textAlign: 'center', color: '#C4B5A5', fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 500 }}>No meetings yet</div>
              : upcomingSlots.map((slot, i) => {
                const bk = slot.bookings?.length > 0 ? slot.bookings[0] : null
                const isDone = done[slot.id]
                const isCurrent = hlNext && !isDone && i === upcomingSlots.findIndex(s => !done[s.id])
                return (
                  <div key={slot.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #F4EDE4', minHeight: 'clamp(68px,9vw,88px)', background: isDone ? '#FAFAFA' : isCurrent ? '#FFFAF7' : '#fff', borderLeft: isCurrent ? '3px solid #F47920' : 'none', transition: 'background .12s' }}>
                    <div style={{ width: 'clamp(60px,8vw,80px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 4px', flexShrink: 0 }}>
                      <div style={{ fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 700, color: isDone ? '#C4B5A5' : '#1B3F7A', letterSpacing: '-.02em' }}>{fmt(slot.start_time)}</div>
                    </div>
                    <div style={{ width: 3, flexShrink: 0, alignSelf: 'stretch', background: isDone ? '#E5E5E5' : '#F4C099' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px,1.4vw,14px)', flex: 1, padding: 'clamp(10px,1.4vw,14px) clamp(14px,2vw,18px)', minWidth: 0 }}>
                      <div style={{ width: 'clamp(36px,4.5vw,48px)', height: 'clamp(36px,4.5vw,48px)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(12px,1.5vw,17px)', fontWeight: 700, flexShrink: 0, background: '#fff', border: '2px solid #F4C099', color: '#F47920', opacity: isDone ? .4 : 1 }}>{bk ? initials(bk.parent_name) : '—'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 700, color: isDone ? '#C4B5A5' : '#1B3F7A', letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: isDone ? 'line-through' : 'none' }}>{bk ? bk.parent_name : '(free)'}</div>
                        <div style={{ fontSize: 'clamp(11px,1.3vw,15px)', color: '#9CA3AF', marginTop: 2 }}>{bk ? bk.student_name || `${slot.booked_count}/${slot.capacity} booked` : `${slot.booked_count}/${slot.capacity} booked`}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px,1.5vw,16px)', paddingRight: 'clamp(14px,2vw,22px)', flexShrink: 0 }}>
                      <div onClick={() => setDone(p => ({ ...p, [slot.id]: !p[slot.id] }))} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
                        <div style={{ width: 'clamp(22px,2.8vw,30px)', height: 'clamp(22px,2.8vw,30px)', borderRadius: 6, border: `2px solid ${isDone ? '#F47920' : '#F4C099'}`, background: isDone ? '#FFF0E6' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', flexShrink: 0 }}>
                          {isDone && DONE_TICK}
                        </div>
                      </div>
                      {bk && <button onClick={() => setCancelModal({ id: slot.id, name: bk.parent_name })}
                        onMouseEnter={e => e.currentTarget.style.color = '#F47920'}
                        onMouseLeave={e => e.currentTarget.style.color = '#C4B5A5'}
                        style={{ width: 'clamp(28px,3.5vw,38px)', height: 'clamp(28px,3.5vw,38px)', borderRadius: 8, background: '#fff', border: 'none', color: '#C4B5A5', cursor: 'pointer', fontSize: 'clamp(18px,2.2vw,26px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 300, lineHeight: 1, padding: 0, transition: 'color .12s' }}>×</button>}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ padding: 'clamp(12px,1.8vw,18px) clamp(16px,2.5vw,28px)', borderTop: '1px solid #F4C099', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF8F3', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#C45A0A', fontWeight: 600 }}>{doneCount} done</span>
            </div>
          </div>
        )}

        {/* PAST MEETINGS */}
        {tab === 'p' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ padding: 'clamp(10px,1.4vw,16px) clamp(16px,2.5vw,28px)', borderBottom: '1px solid #F4C099', background: '#FFF8F3', flexShrink: 0 }}>
              <span style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#9CA3AF', fontWeight: 500 }}>{pastSlots.length} past meetings</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {pastSlots.length === 0 ? <div style={{ padding: 'clamp(32px,5vw,60px)', textAlign: 'center', color: '#C4B5A5', fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 500 }}>No past meetings yet</div> : null}
            </div>
          </div>
        )}

        {/* MANAGE SLOTS */}
        {tab === 'm' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Summary bar */}
            <div style={{ padding: '10px 20px', borderBottom: '1px solid #F4C099', background: '#FFF8F3', display: 'flex', gap: 20, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#C45A0A' }}>{bookedSlots.length} booked</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#9CA3AF' }}>{freeSlots.length} free</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#9CA3AF' }}>{breakSlots.length} break</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#9CA3AF' }}>0 blocked</span>
            </div>

            {/* Horizontal scrolling grid */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {loading
              ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
              : bands.length === 0
              ? <div style={{ padding: 40, textAlign: 'center', color: '#C4B5A5', fontSize: 17 }}>No slots yet</div>
              : (
                <div className="no-scroll" style={{ display: 'flex', flexDirection: 'row', overflowX: 'auto', gap: 12, padding: '16px 20px', minHeight: 120, flexShrink: 0, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
                  {bands.map((band, bi) => {
                    const bandBooked = band.slots.filter(s => s.booked_count > 0).length
                    return (
                      <div key={bi} style={{ minWidth: 160, flexShrink: 0 }}>
                          {/* Column header */}
                          <div style={{ paddingBottom: 8, marginBottom: 10, borderBottom: '2px solid #F4C099' }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#1B3F7A' }}>{band.label}</div>
                            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{bandBooked} booked</div>
                          </div>
                          {/* Slot cards */}
                          {[...band.slots]
                            .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
                            .map(slot => {
                              const bk = slot.bookings?.[0] ?? null
                              const isBooked = slot.booked_count > 0
                              const isBreak = slot.is_break || slot.type === 'break'
                              const isSel = selectedSlot?.id === slot.id
                              return (
                                <div
                                  key={slot.id}
                                  onClick={() => setSelectedSlot(isSel ? null : slot)}
                                  style={{
                                    borderRadius: 10,
                                    padding: '10px 12px',
                                    marginBottom: 8,
                                    cursor: 'pointer',
                                    background: isBreak ? '#FFE8D0' : isBooked ? '#FFF0E6' : '#F9FAFB',
                                    border: isBreak ? '1.5px dashed #F47920' : isBooked ? '1.5px solid #F4C099' : '1.5px solid #E5E7EB',
                                    outline: isSel ? '2px solid #1B3F7A' : '2px solid transparent',
                                    outlineOffset: 1,
                                    boxSizing: 'border-box',
                                  }}
                                >
                                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1B3F7A', marginBottom: 4 }}>{fmt(slot.start_time)}</div>
                                  {isBooked ? (
                                    <>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: '#C45A0A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bk?.parent_name || 'Booked'}</div>
                                      {bk?.student_name && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bk.student_name}</div>}
                                    </>
                                  ) : isBreak ? (
                                    <div style={{ fontSize: 12, color: '#C45A0A', fontWeight: 600 }}>Break</div>
                                  ) : (
                                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>Free</div>
                                  )}
                                </div>
                              )
                            })
                          }
                        </div>
                      )
                    })}
                  </div>
                )
            }
            </div>

            {/* Drawer */}
            <div style={{ borderTop: '1.5px solid #F4C099', background: '#FFF8F3', padding: '14px 20px', flexShrink: 0 }}>
              {selectedSlot ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1B3F7A', marginBottom: 10 }}>
                    {fmt(selectedSlot.start_time)}{selectedSlot.bookings?.length > 0 ? ` — ${selectedSlot.bookings[0].parent_name}` : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {selectedSlot.bookings?.length > 0 && <button onClick={() => { showToast('Booking cancelled'); setSelectedSlot(null) }} style={{ fontSize: 14, padding: '9px 20px', borderRadius: 50, cursor: 'pointer', fontWeight: 600, border: '1.5px solid #F4C099', background: '#fff', color: '#1B3F7A', fontFamily: 'inherit' }}>Cancel booking</button>}
                    <button onClick={() => { showToast('Slot blocked'); setSelectedSlot(null) }} style={{ fontSize: 14, padding: '9px 20px', borderRadius: 50, cursor: 'pointer', fontWeight: 600, border: '1.5px solid #F4C099', background: '#fff', color: '#1B3F7A', fontFamily: 'inherit' }}>Block slot</button>
                    <button onClick={() => setSelectedSlot(null)} style={{ fontSize: 14, padding: '9px 20px', borderRadius: 50, cursor: 'pointer', fontWeight: 600, border: '1.5px solid #F4C099', background: '#fff', color: '#9CA3AF', fontFamily: 'inherit' }}>Dismiss</button>
                  </div>
                </>
              ) : <div style={{ fontSize: 14, color: '#C4B5A5', fontWeight: 500, textAlign: 'center' }}>Tap any slot to manage it</div>}
            </div>

            {/* Bottom bar */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #F4C099', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF8F3', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 14, color: '#C45A0A', fontWeight: 600 }}>{bookedSlots.length} of {slots.length} booked</span>
              <button onClick={() => showToast('Exporting PDF...')} style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 50, background: '#fff', color: '#F47920', border: '1.5px solid #F4C099', cursor: 'pointer', fontFamily: 'inherit' }}>Export PDF</button>
            </div>
          </div>
        )}
      </div>

      {/* VENUE MODAL */}
      {venueModal && (
        <div onClick={() => setVenueModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20, backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 'clamp(24px,3.5vw,40px)', width: '100%', maxWidth: 'min(380px,calc(100vw - 32px))', textAlign: 'left', boxShadow: '0 12px 40px rgba(0,0,0,.15)' }}>
            <div style={{ fontSize: 'clamp(17px,2.2vw,24px)', fontWeight: 700, color: '#1B3F7A', marginBottom: 8 }}>Change venue</div>
            <div style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#9CA3AF', marginBottom: 'clamp(10px,1.4vw,16px)', lineHeight: 1.5 }}>Enter the new room or location</div>
            <input value={venueInput} onChange={e => setVenueInput(e.target.value)} placeholder="e.g. Room 201"
              style={{ width: '100%', padding: 'clamp(12px,1.6vw,16px)', fontSize: 'clamp(14px,1.8vw,18px)', border: '2px solid #F4C099', borderRadius: 12, outline: 'none', fontFamily: 'inherit', color: '#1B3F7A', marginBottom: 'clamp(16px,2.5vw,24px)', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = '#F47920'} onBlur={e => e.target.style.borderColor = '#F4C099'} />
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setVenueModal(false)} style={{ flex: 1, padding: 'clamp(12px,1.6vw,16px)', borderRadius: 12, fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 700, cursor: 'pointer', border: '2px solid #F4C099', background: '#fff', color: '#9CA3AF', fontFamily: 'inherit' }}>Back</button>
              <button onClick={() => { if (venueInput.trim()) { setVenueText(venueInput.trim()); showToast('Venue updated') } setVenueModal(false) }} style={{ flex: 1, padding: 'clamp(12px,1.6vw,16px)', borderRadius: 12, fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 700, cursor: 'pointer', border: 'none', background: '#F47920', color: '#fff', fontFamily: 'inherit' }}>Save</button>
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
      <div onClick={() => setAddOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', opacity: addOpen ? 1 : 0, pointerEvents: addOpen ? 'all' : 'none', transition: 'opacity .25s', zIndex: 100 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '20px 20px 0 0', padding: 'clamp(20px,3vw,32px)', transform: addOpen ? 'translateY(0)' : 'translateY(100%)', transition: 'transform .3s cubic-bezier(.4,0,.2,1)', zIndex: 101, boxShadow: '0 -8px 40px rgba(0,0,0,.12)', maxWidth: 500, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'clamp(16px,2vw,24px)' }}>
          <span style={{ fontSize: 'clamp(15px,1.8vw,20px)', fontWeight: 700, color: '#1B3F7A' }}>Add New Slot</span>
          <button onClick={() => setAddOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lbl}>Date</label><input type="date" style={inp} value={newDate} onChange={e => setNewDate(e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Start</label><input type="time" style={inp} value={newStart} onChange={e => setNewStart(e.target.value)} /></div>
            <div><label style={lbl}>End</label><input type="time" style={inp} value={newEnd} onChange={e => setNewEnd(e.target.value)} /></div>
          </div>
          <div><label style={lbl}>Capacity</label>
            <select style={inp} value={newCap} onChange={e => setNewCap(Number(e.target.value))}>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} parent{n>1?'s':''}</option>)}
            </select>
          </div>
          <button onClick={createNewSlot} disabled={creating} style={{ background: '#1B3F7A', color: '#fff', border: 'none', borderRadius: 10, padding: 'clamp(10px,1.5vw,14px)', fontSize: 'clamp(13px,1.5vw,16px)', fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? .7 : 1, fontFamily: 'inherit', marginTop: 4 }}>
            {creating ? 'Creating…' : 'Create Slot'}
          </button>
        </div>
      </div>

      <Toast msg={toast} />
    </div>
  )
}
