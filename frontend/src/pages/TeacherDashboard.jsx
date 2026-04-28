import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' })
api.interceptors.request.use(cfg => { const t = localStorage.getItem('token'); if (t) cfg.headers.Authorization = `Bearer ${t}`; return cfg })
const getMySlots = () => api.get('/slots/mine').then(r => r.data)
const createSlot = body => api.post('/slots/', body).then(r => r.data)

const C = { orange: '#F47920', navy: '#1B3F7A', bg: '#FFF8F3', border: '#F4C099', grey: '#9CA3AF' }
const fmt = iso => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })

function Toast({ msg }) {
  return <div style={{ position: 'fixed', bottom: 'clamp(16px,2.5vw,28px)', left: '50%', transform: 'translateX(-50%)', background: C.navy, color: '#fff', padding: 'clamp(10px,1.4vw,16px) clamp(18px,2.5vw,28px)', borderRadius: 50, fontSize: 'clamp(13px,1.6vw,17px)', fontWeight: 600, opacity: msg ? 1 : 0, transition: 'opacity .3s', pointerEvents: 'none', zIndex: 999, maxWidth: 'calc(100vw - 32px)', textAlign: 'center', whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(27,63,122,.3)' }}>{msg}</div>
}

function AddSlotDrawer({ open, onClose, onCreated, showToast }) {
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [cap, setCap] = useState(1)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!date || !start || !end) { showToast('Fill in all fields'); return }
    setLoading(true)
    try { await createSlot({ start_time: `${date}T${start}:00`, end_time: `${date}T${end}:00`, capacity: cap }); showToast('Slot created!'); onCreated(); onClose() }
    catch (err) { showToast(err.response?.data?.detail || 'Failed to create slot') }
    setLoading(false)
  }

  const inp = { width: '100%', padding: 'clamp(10px,1.4vw,14px) clamp(12px,1.6vw,16px)', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 'clamp(13px,1.5vw,15px)', fontFamily: 'inherit', color: C.navy, background: '#fff', outline: 'none', boxSizing: 'border-box' }
  const lbl = { fontSize: 'clamp(11px,1.2vw,13px)', fontWeight: 700, color: '#C45A0A', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4, display: 'block' }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none', transition: 'opacity .25s', zIndex: 100 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '20px 20px 0 0', padding: 'clamp(20px,3vw,32px)', transform: open ? 'translateY(0)' : 'translateY(100%)', transition: 'transform .3s cubic-bezier(.4,0,.2,1)', zIndex: 101, boxShadow: '0 -8px 40px rgba(0,0,0,.12)', maxWidth: 500, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'clamp(16px,2vw,24px)' }}>
          <span style={{ fontSize: 'clamp(15px,1.8vw,20px)', fontWeight: 700, color: C.navy }}>Add New Slot</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.grey, padding: 4 }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lbl}>Date</label><input type="date" style={inp} value={date} onChange={e => setDate(e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Start time</label><input type="time" style={inp} value={start} onChange={e => setStart(e.target.value)} /></div>
            <div><label style={lbl}>End time</label><input type="time" style={inp} value={end} onChange={e => setEnd(e.target.value)} /></div>
          </div>
          <div><label style={lbl}>Capacity</label>
            <select style={inp} value={cap} onChange={e => setCap(Number(e.target.value))}>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} parent{n>1?'s':''}</option>)}
            </select>
          </div>
          <button onClick={submit} disabled={loading} style={{ background: C.orange, color: '#fff', border: 'none', borderRadius: 10, padding: 'clamp(10px,1.5vw,14px)', fontSize: 'clamp(13px,1.5vw,16px)', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1, fontFamily: 'inherit', marginTop: 4 }}>
            {loading ? 'Creating…' : 'Create Slot'}
          </button>
        </div>
      </div>
    </>
  )
}

export default function TeacherDashboard() {
  const { user, logoutUser } = useAuth()
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('sched')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [expanded, setExpanded] = useState({})

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try { const d = await getMySlots(); setSlots(d) }
    catch { showToast('Failed to load slots') }
    setLoading(false)
  }

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const initials = user?.name ? user.name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'T'
  const booked = slots.filter(s => s.booked_count > 0).length
  const free = slots.length - booked
  const fillRate = slots.length > 0 ? Math.round((booked / slots.length) * 100) : 0

  return (
    <div style={{ background: C.bg, minHeight: '100svh', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 'clamp(10px,1.5vw,18px)', overflow: 'hidden', width: 'min(96vw,900px)', margin: 'clamp(10px,2vw,20px) auto', boxShadow: '0 2px 20px rgba(0,0,0,.06)', display: 'flex', flexDirection: 'column', height: 'calc(100svh - clamp(20px,4vw,40px))' }}>

        {/* Topbar */}
        <div style={{ background: C.orange, padding: 'clamp(10px,1.8vw,20px) clamp(14px,2.5vw,28px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px,1.5vw,16px)', flex: 1, minWidth: 0 }}>
            <div style={{ width: 'clamp(34px,4.5vw,48px)', height: 'clamp(34px,4.5vw,48px)', borderRadius: '50%', background: 'rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(12px,1.6vw,17px)', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'clamp(14px,2vw,22px)', fontWeight: 700, color: '#fff', letterSpacing: '-.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Teacher'}</div>
              <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: 'rgba(255,255,255,.8)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>PTM 09 Apr 2026</div>
            </div>
          </div>
          <button onClick={logoutUser} style={{ fontSize: 'clamp(10px,1.2vw,13px)', fontWeight: 600, padding: 'clamp(4px,.8vw,8px) clamp(10px,1.5vw,16px)', borderRadius: 20, background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Sign out</button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {[{ label: 'Total', value: slots.length }, { label: 'Booked', value: booked }, { label: 'Free', value: free }, { label: 'Fill rate', value: `${fillRate}%` }].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: 'clamp(6px,1vw,12px) 0', textAlign: 'center', borderRight: i < 3 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ fontSize: 'clamp(16px,2.2vw,26px)', fontWeight: 700, color: C.navy }}>{s.value}</div>
              <div style={{ fontSize: 'clamp(8px,1vw,11px)', color: C.grey, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: '#fff', borderBottom: `2px solid ${C.border}`, flexShrink: 0 }}>
          {[['sched', 'My Schedule'], ['manage', 'Manage Slots']].map(([key, lbl]) => (
            <div key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: 'clamp(12px,1.8vw,18px) 8px', textAlign: 'center', fontSize: 'clamp(13px,1.6vw,17px)', fontWeight: 600, cursor: 'pointer', color: tab === key ? C.orange : '#C4B5A5', borderBottom: `3px solid ${tab === key ? C.orange : 'transparent'}`, marginBottom: -2, transition: 'all .2s' }}>{lbl}</div>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.grey }}>Loading…</div>
        ) : slots.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C4B5A5', fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 500, flexDirection: 'column', gap: 8 }}>
            <div>No slots yet</div>
            <div style={{ fontSize: 'clamp(12px,1.4vw,16px)' }}>Click "Add slot" below to get started</div>
          </div>
        ) : tab === 'sched' ? (
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {slots.map(slot => (
              <div key={slot.id} style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid #F4EDE4`, minHeight: 'clamp(68px,9vw,88px)', background: '#fff' }}>
                <div style={{ width: 'clamp(60px,8vw,80px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px', flexShrink: 0 }}>
                  <div style={{ fontSize: 'clamp(13px,1.6vw,18px)', fontWeight: 700, color: C.navy, letterSpacing: '-.03em' }}>{fmt(slot.start_time)}</div>
                </div>
                <div style={{ width: 3, flexShrink: 0, alignSelf: 'stretch', background: slot.booked_count > 0 ? C.orange : '#F4C099' }} />
                <div style={{ flex: 1, minWidth: 0, padding: 'clamp(10px,1.4vw,14px) clamp(14px,2vw,18px)' }}>
                  <div style={{ fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 700, color: C.navy, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {slot.bookings?.length > 0 ? slot.bookings.map(b => b.parent_name).join(', ') : '—'}
                  </div>
                  <div style={{ fontSize: 'clamp(11px,1.3vw,15px)', color: C.grey, marginTop: 2 }}>{slot.booked_count}/{slot.capacity} booked · {fmt(slot.start_time)} – {fmt(slot.end_time)}</div>
                </div>
                <div style={{ paddingRight: 'clamp(14px,2vw,22px)', flexShrink: 0 }}>
                  <span style={{ fontSize: 'clamp(9px,1.1vw,12px)', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: slot.booked_count > 0 ? '#FFF0E6' : '#F9FAFB', color: slot.booked_count > 0 ? '#C45A0A' : C.grey, border: `1px solid ${slot.booked_count > 0 ? C.border : '#E5E7EB'}` }}>{slot.booked_count > 0 ? 'Booked' : 'Free'}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 'clamp(8px,1.2vw,14px) clamp(10px,1.5vw,18px)' }}>
            {slots.map(slot => {
              const pct = slot.capacity > 0 ? Math.round((slot.booked_count / slot.capacity) * 100) : 0
              const isOpen = expanded[slot.id]
              return (
                <div key={slot.id} style={{ marginBottom: 4 }}>
                  <div onClick={() => slot.bookings?.length > 0 && setExpanded(prev => ({ ...prev, [slot.id]: !prev[slot.id] }))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'clamp(7px,1vw,11px) clamp(10px,1.4vw,16px)', background: isOpen ? '#FFF0E6' : C.bg, border: `1px solid ${isOpen ? C.orange : C.border}`, borderRadius: isOpen && slot.bookings?.length > 0 ? '10px 10px 0 0' : 10, cursor: slot.bookings?.length > 0 ? 'pointer' : 'default' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px,1.2vw,14px)' }}>
                      <span style={{ fontSize: 'clamp(11px,1.3vw,14px)', fontWeight: 700, color: C.navy, minWidth: 'clamp(60px,7vw,80px)' }}>{fmt(slot.start_time)}</span>
                      <span style={{ fontSize: 'clamp(10px,1.1vw,12px)', color: C.grey }}>→ {fmt(slot.end_time)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px,1vw,12px)' }}>
                      <div style={{ width: 'clamp(48px,6vw,80px)', height: 5, background: '#FDE9D4', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: C.orange, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: C.grey, fontWeight: 600, minWidth: 32 }}>{slot.booked_count}/{slot.capacity}</span>
                      {slot.bookings?.length > 0 && <span style={{ fontSize: 14, color: C.orange, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s', display: 'inline-block' }}>›</span>}
                    </div>
                  </div>
                  {isOpen && slot.bookings?.length > 0 && (
                    <div style={{ background: '#fff', border: `1px solid ${C.orange}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 'clamp(8px,1.2vw,14px)' }}>
                      {slot.bookings.map((b, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < slot.bookings.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                          <span style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: C.navy, fontWeight: 600 }}>{b.parent_name}</span>
                          <span style={{ fontSize: 'clamp(9px,1vw,11px)', fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#DCFCE7', color: '#166534' }}>Confirmed</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Bottom bar */}
        <div style={{ padding: 'clamp(12px,1.8vw,18px) clamp(16px,2.5vw,28px)', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.bg, flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#C45A0A', fontWeight: 600 }}>{booked} of {slots.length} slots booked</span>
          <button onClick={() => setDrawerOpen(true)} style={{ background: C.orange, color: '#fff', border: 'none', borderRadius: 10, padding: 'clamp(7px,1vw,11px) clamp(14px,2vw,22px)', fontSize: 'clamp(12px,1.4vw,15px)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add slot</button>
        </div>
      </div>

      <AddSlotDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onCreated={fetchData} showToast={showToast} />
      <Toast msg={toast} />
    </div>
  )
}
