import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' })
api.interceptors.request.use(cfg => { const token = localStorage.getItem('token'); if (token) cfg.headers.Authorization = `Bearer ${token}`; return cfg })
const getAllBookings = () => api.get('/bookings/all').then(r => r.data)
const getAllSlots = () => api.get('/slots/all').then(r => r.data)

const C = { orange: '#F47920', navy: '#1B3F7A', bg: '#FFF8F3', border: '#F4C099', grey: '#9CA3AF', lightOrange: '#FFF0E6' }
const fmt = iso => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })

function Toast({ msg }) {
  return <div style={{ position: 'fixed', bottom: 'clamp(16px,2.5vw,28px)', left: '50%', transform: 'translateX(-50%)', background: C.navy, color: '#fff', padding: 'clamp(10px,1.4vw,16px) clamp(18px,2.5vw,28px)', borderRadius: 50, fontSize: 'clamp(13px,1.6vw,17px)', fontWeight: 600, opacity: msg ? 1 : 0, transition: 'opacity .3s', pointerEvents: 'none', zIndex: 999, maxWidth: 'calc(100vw - 32px)', textAlign: 'center', whiteSpace: 'nowrap' }}>{msg}</div>
}

export default function AdminDashboard() {
  const { logoutUser } = useAuth()
  const [bookings, setBookings] = useState([])
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const [expanded, setExpanded] = useState({})

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try { const [b, s] = await Promise.all([getAllBookings(), getAllSlots()]); setBookings(b); setSlots(s) }
    catch { showToast('Failed to load data') }
    setLoading(false)
  }

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const teacherMap = {}
  slots.forEach(s => { if (!teacherMap[s.teacher_name]) teacherMap[s.teacher_name] = []; teacherMap[s.teacher_name].push(s) })
  const teachers = Object.keys(teacherMap).sort()
  const totalBookings = bookings.filter(b => b.status !== 'cancelled').length
  const totalSlots = slots.length
  const bookedSlots = slots.filter(s => s.booked_count > 0).length
  const fillRate = totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0
  const filteredBookings = bookings.filter(b => b.parent_name?.toLowerCase().includes(search.toLowerCase()) || b.teacher_name?.toLowerCase().includes(search.toLowerCase()))
  const toggleExpand = key => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  const copyInvite = () => { navigator.clipboard.writeText('INVENT-2026'); showToast('Invite code copied!') }

  return (
    <div style={{ background: C.bg, minHeight: '100svh', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 'clamp(10px,1.5vw,18px)', overflow: 'hidden', width: 'min(96vw, 860px)', margin: 'clamp(10px,2vw,24px) auto', display: 'flex', flexDirection: 'column', height: 'calc(100svh - clamp(20px,4vw,48px))' }}>

        <div style={{ padding: 'clamp(8px,1.2vw,16px) clamp(12px,2vw,24px)', background: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'clamp(15px,2vw,22px)', fontWeight: 700, color: '#fff', letterSpacing: '-.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Inventure Academy</div>
            <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: 'rgba(255,255,255,.8)', marginTop: 2 }}>Admin · PTM 09 Apr 2026</div>
          </div>
          <button onClick={logoutUser} style={{ fontSize: 'clamp(10px,1.2vw,13px)', fontWeight: 600, padding: 'clamp(4px,.8vw,8px) clamp(10px,1.5vw,16px)', borderRadius: 20, background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Sign out</button>
        </div>

        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {[{ label: 'Teachers', value: teachers.length }, { label: 'Bookings', value: totalBookings }, { label: 'Slots', value: totalSlots }, { label: 'Fill rate', value: `${fillRate}%` }].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: 'clamp(6px,1vw,12px) 0', textAlign: 'center', borderRight: i < 3 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ fontSize: 'clamp(16px,2.2vw,26px)', fontWeight: 700, color: C.navy }}>{s.value}</div>
              <div style={{ fontSize: 'clamp(8px,1vw,11px)', color: C.grey, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {[['overview', 'Overview'], ['bookings', 'All Bookings']].map(([key, lbl]) => (
            <div key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: 'clamp(10px,1.5vw,16px)', textAlign: 'center', fontSize: 'clamp(12px,1.5vw,16px)', fontWeight: 600, cursor: 'pointer', color: tab === key ? C.orange : C.grey, borderBottom: `3px solid ${tab === key ? C.orange : 'transparent'}`, background: tab === key ? C.bg : '#fff', transition: 'all .15s' }}>{lbl}</div>
          ))}
        </div>

        {loading ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.grey }}>Loading…</div> : tab === 'overview' ? (
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 'clamp(10px,1.5vw,18px) clamp(12px,1.8vw,22px)' }}>
            {teachers.map(t => {
              const tSlots = teacherMap[t]
              const booked = tSlots.filter(s => s.booked_count > 0).length
              const pct = tSlots.length > 0 ? Math.round((booked / tSlots.length) * 100) : 0
              const isOpen = expanded[t]
              const bookedList = tSlots.filter(s => s.booked_count > 0)
              return (
                <div key={t} style={{ marginBottom: 6 }}>
                  <div onClick={() => toggleExpand(t)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'clamp(8px,1.2vw,14px) clamp(10px,1.5vw,18px)', background: isOpen ? C.lightOrange : C.bg, border: `1px solid ${isOpen ? C.orange : C.border}`, borderRadius: isOpen && bookedList.length > 0 ? '10px 10px 0 0' : 10, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px,1.2vw,14px)' }}>
                      <div style={{ width: 'clamp(28px,3.5vw,38px)', height: 'clamp(28px,3.5vw,38px)', borderRadius: '50%', background: C.orange, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(10px,1.2vw,14px)', fontWeight: 700, flexShrink: 0 }}>{t.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
                      <div>
                        <div style={{ fontSize: 'clamp(12px,1.5vw,16px)', fontWeight: 700, color: C.navy }}>{t}</div>
                        <div style={{ fontSize: 'clamp(10px,1.1vw,12px)', color: C.grey }}>{tSlots.length} slots · {booked} booked</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px,1vw,12px)' }}>
                      <div style={{ width: 'clamp(48px,6vw,80px)', height: 5, background: '#FDE9D4', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: C.orange, borderRadius: 3 }} /></div>
                      <span style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: C.grey, fontWeight: 600, minWidth: 32 }}>{pct}%</span>
                      {bookedList.length > 0 && <span style={{ fontSize: 14, color: C.orange, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s', display: 'inline-block' }}>›</span>}
                    </div>
                  </div>
                  {isOpen && bookedList.length > 0 && (
                    <div style={{ background: '#fff', border: `1px solid ${C.orange}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 'clamp(8px,1.2vw,14px)', marginBottom: 0 }}>
                      {bookedList.map((s, i) => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < bookedList.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                          <span style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: C.navy, fontWeight: 600 }}>{fmt(s.start_time)}</span>
                          <span style={{ fontSize: 'clamp(10px,1.1vw,12px)', color: C.grey }}>{s.booked_count}/{s.capacity} booked</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            <div style={{ marginTop: 16, padding: 'clamp(12px,1.8vw,20px)', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10 }}>
              <div style={{ fontSize: 'clamp(11px,1.2vw,13px)', fontWeight: 700, color: '#C45A0A', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>School invite code</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 'clamp(18px,2.5vw,28px)', fontWeight: 800, color: C.navy, letterSpacing: '.05em', flex: 1 }}>INVENT-2026</span>
                <button onClick={copyInvite} style={{ padding: 'clamp(6px,1vw,10px) clamp(14px,2vw,20px)', background: C.navy, color: '#fff', border: 'none', borderRadius: 8, fontSize: 'clamp(11px,1.3vw,14px)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Copy</button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: 'clamp(10px,1.5vw,16px) clamp(12px,1.8vw,22px)', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <input type="text" placeholder="Search by parent or teacher name…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: 'clamp(8px,1.2vw,12px) clamp(10px,1.5vw,14px)', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 'clamp(12px,1.4vw,15px)', fontFamily: 'inherit', color: C.navy, background: '#fff', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {filteredBookings.length === 0 ? <div style={{ padding: 32, textAlign: 'center', color: C.grey, fontSize: 14 }}>No bookings found.</div> : filteredBookings.map(b => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', padding: 'clamp(8px,1.2vw,14px) clamp(10px,1.5vw,18px)', borderBottom: `1px solid ${C.border}`, background: '#fff' }}>
                  <div style={{ width: 'clamp(38px,5vw,52px)', minWidth: 38, textAlign: 'right', fontSize: 'clamp(11px,1.3vw,14px)', fontWeight: 700, color: C.navy, paddingRight: 10, flexShrink: 0 }}>{b.start_time ? fmt(b.start_time) : '—'}</div>
                  <div style={{ width: 2, alignSelf: 'stretch', background: C.border, flexShrink: 0, margin: '0 10px' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'clamp(12px,1.5vw,16px)', fontWeight: 700, color: C.navy, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.parent_name}</div>
                    <div style={{ fontSize: 'clamp(10px,1.1vw,12px)', color: C.grey }}>→ {b.teacher_name}</div>
                  </div>
                  <span style={{ fontSize: 'clamp(9px,1vw,11px)', fontWeight: 700, padding: '2px 8px', borderRadius: 10, flexShrink: 0, background: b.status === 'confirmed' ? '#DCFCE7' : '#F3F4F6', color: b.status === 'confirmed' ? '#166534' : C.grey }}>{b.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ padding: 'clamp(8px,1.2vw,14px) clamp(10px,1.5vw,18px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.bg, borderTop: `1px solid ${C.border}`, flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 'clamp(11px,1.4vw,16px)', color: '#C45A0A', fontWeight: 500 }}>{totalBookings} bookings · {totalSlots} slots</span>
          <button onClick={() => showToast('Coming soon')} style={{ padding: 'clamp(6px,1vw,10px) clamp(14px,2vw,22px)', background: C.navy, color: '#fff', border: 'none', borderRadius: 8, fontSize: 'clamp(11px,1.3vw,14px)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add teacher</button>
        </div>
      </div>
      <Toast msg={toast} />
    </div>
  )
}
