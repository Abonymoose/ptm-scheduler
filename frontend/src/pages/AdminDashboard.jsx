import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' })
api.interceptors.request.use(cfg => { const t = localStorage.getItem('token'); if (t) cfg.headers.Authorization = `Bearer ${t}`; return cfg })
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
  const toggle = key => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  const copyInvite = () => { navigator.clipboard.writeText('INVENT-2026'); showToast('Invite code copied!') }

  return (
    <div style={{ background: C.bg, minHeight: '100svh', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 'clamp(10px,1.5vw,18px)', overflow: 'hidden', width: 'min(96vw,860px)', margin: 'clamp(10px,2vw,24px) auto', display: 'flex', flexDirection: 'column', height: 'calc(100svh - clamp(20px,4vw,48px))' }}>

        {/* Topbar */}
        <div style={{ padding: 'clamp(8px,1.2vw,16px) clamp(12px,2vw,24px)', background: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 'clamp(28px,3.5vw,44px)', height: 'clamp(28px,3.5vw,44px)', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(9px,1.1vw,13px)', fontWeight: 700, color: C.orange, flexShrink: 0 }}>IA</div>
            <div>
              <div style={{ fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 700, color: '#fff', letterSpacing: '-.03em' }}>Inventure Academy</div>
              <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: 'rgba(255,255,255,.8)', marginTop: 1 }}>Admin · PTM 09 Apr 2026</div>
            </div>
          </div>
          <button onClick={logoutUser} style={{ fontSize: 'clamp(10px,1.2vw,13px)', fontWeight: 600, padding: 'clamp(4px,.8vw,8px) clamp(10px,1.5vw,16px)', borderRadius: 20, background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Sign out</button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {[{ label: 'Teachers', value: teachers.length }, { label: 'Bookings', value: totalBookings }, { label: 'Slots', value: totalSlots }, { label: 'Fill rate', value: `${fillRate}%` }].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: 'clamp(6px,1vw,12px) 0', textAlign: 'center', borderRight: i < 3 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ fontSize: 'clamp(16px,2.2vw,26px)', fontWeight: 700, color: C.navy }}>{s.value}</div>
              <div style={{ fontSize: 'clamp(8px,1vw,11px)', color: C.grey, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {[['overview', 'Overview'], ['bookings', 'All Bookings']].map(([key, lbl]) => (
            <div key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: 'clamp(10px,1.5vw,16px)', textAlign: 'center', fontSize: 'clamp(12px,1.5vw,16px)', fontWeight: 600, cursor: 'pointer', color: tab === key ? C.orange : C.grey, borderBottom: `3px solid ${tab === key ? C.orange : 'transparent'}`, background: tab === key ? C.bg : '#fff', transition: 'all .15s' }}>{lbl}</div>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.grey }}>Loading…</div>
        ) : tab === 'overview' ? (
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 'clamp(8px,1.2vw,14px) clamp(10px,1.5vw,18px)' }}>
            {teachers.map(t => {
              const tSlots = teacherMap[t]
              const bk = tSlots.filter(s => s.booked_count > 0).length
              const pct = tSlots.length > 0 ? Math.round((bk / tSlots.length) * 100) : 0
              const isOpen = expanded[t]
              const bookedList = tSlots.filter(s => s.booked_count > 0)
              const initials = t.replace(/^(Ms\.|Mr\.|Dr\.)/,'').trim().split(' ').filter(Boolean).map(w => w[0]).join('').slice(0,2).toUpperCase()
              return (
                <div key={t} style={{ borderRadius: 'clamp(6px,1vw,10px)', border: `1px solid ${C.border}`, marginBottom: 'clamp(4px,.6vw,7px)', overflow: 'hidden' }}>
                  <div onClick={() => toggle(t)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'clamp(6px,.9vw,11px) clamp(8px,1.2vw,14px)', background: C.bg, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px,1vw,10px)' }}>
                      <div style={{ width: 'clamp(22px,2.8vw,34px)', height: 'clamp(22px,2.8vw,34px)', borderRadius: '50%', background: '#FFF0E6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(8px,1vw,12px)', fontWeight: 700, color: C.orange, flexShrink: 0 }}>{initials}</div>
                      <div>
                        <div style={{ fontSize: 'clamp(11px,1.3vw,15px)', fontWeight: 600, color: C.navy }}>{t}</div>
                        <div style={{ fontSize: 'clamp(8px,1vw,12px)', color: C.grey }}>{tSlots.length} slots</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(5px,.8vw,10px)' }}>
                      <div style={{ width: 'clamp(60px,8vw,100px)', height: 5, background: '#FDE9D4', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: C.orange, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 'clamp(10px,1.2vw,14px)', color: C.grey, minWidth: 32, textAlign: 'right', fontWeight: 600 }}>{pct}%</span>
                      <span style={{ fontSize: 'clamp(14px,1.8vw,20px)', color: C.orange, transition: 'transform .2s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none', marginLeft: 4 }}>›</span>
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ borderTop: `1px solid ${C.border}`, padding: 'clamp(8px,1.2vw,14px)', background: '#fff' }}>
                      {bookedList.length === 0 ? <div style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: C.grey }}>No bookings yet.</div> : bookedList.map((s, i) => (
                        <div key={s.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < bookedList.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                          <div style={{ fontSize: 'clamp(11px,1.3vw,14px)', fontWeight: 600, color: C.grey, minWidth: 80 }}>{fmt(s.start_time)}</div>
                          <div style={{ fontSize: 'clamp(12px,1.5vw,15px)', fontWeight: 600, color: C.navy, flex: 1 }}>{s.bookings?.map(b => b.parent_name).join(', ') || '—'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Invite code */}
            <div style={{ marginTop: 8, background: '#FFF0E6', border: `1px solid ${C.border}`, borderRadius: 'clamp(8px,1.2vw,14px)', padding: 'clamp(10px,1.5vw,18px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 'clamp(9px,1.1vw,12px)', fontWeight: 600, color: C.grey, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>School invite code</div>
                <div style={{ fontSize: 'clamp(18px,2.5vw,28px)', fontWeight: 700, color: C.navy, letterSpacing: '.08em' }}>INVENT-2026</div>
              </div>
              <button onClick={copyInvite} style={{ fontSize: 'clamp(11px,1.4vw,14px)', fontWeight: 700, padding: 'clamp(6px,.9vw,10px) clamp(12px,1.6vw,18px)', borderRadius: 8, background: C.navy, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Copy</button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: 'clamp(8px,1.2vw,14px)', borderBottom: `1px solid ${C.border}`, background: C.bg, display: 'flex', gap: 8, flexShrink: 0 }}>
              <input type="text" placeholder="Search parent or teacher..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, padding: 'clamp(7px,1vw,12px) clamp(10px,1.5vw,16px)', fontSize: 'clamp(11px,1.4vw,15px)', border: `1.5px solid ${C.border}`, borderRadius: 'clamp(8px,1vw,12px)', outline: 'none', fontFamily: 'inherit', color: C.navy, boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {filteredBookings.length === 0 ? (
                <div style={{ textAlign: 'center', color: C.grey, fontSize: 'clamp(13px,1.6vw,17px)', marginTop: 40 }}>{search ? 'No results.' : 'No bookings yet.'}</div>
              ) : filteredBookings.map((bk, i) => (
                <div key={bk.id || i}>
                  <div onClick={() => toggle(`b-${bk.id}`)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'clamp(5px,.8vw,9px) clamp(8px,1.2vw,14px)', borderRadius: expanded[`b-${bk.id}`] ? 'clamp(5px,.8vw,8px) clamp(5px,.8vw,8px) 0 0' : 'clamp(5px,.8vw,8px)', border: `1px solid ${expanded[`b-${bk.id}`] ? C.orange : C.border}`, marginBottom: expanded[`b-${bk.id}`] ? 0 : 3, background: expanded[`b-${bk.id}`] ? '#FFF0E6' : C.bg, cursor: 'pointer', transition: 'background .15s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ color: C.grey, minWidth: 48, fontSize: 'clamp(10px,1.2vw,14px)' }}>{bk.start_time ? fmt(bk.start_time) : '—'}</div>
                      <div style={{ fontSize: 'clamp(12px,1.5vw,15px)', fontWeight: 700, color: C.navy }}>{bk.parent_name}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 'clamp(9px,1.1vw,12px)', color: C.grey, display: window.innerWidth > 520 ? 'block' : 'none' }}>with {bk.teacher_name}</div>
                      <div style={{ fontSize: 'clamp(10px,1.2vw,12px)', fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: bk.status === 'cancelled' ? '#F3F4F6' : '#FFF0E6', color: bk.status === 'cancelled' ? C.grey : '#C45A0A' }}>{bk.status === 'cancelled' ? 'Cancelled' : 'Confirmed'}</div>
                    </div>
                  </div>
                  {expanded[`b-${bk.id}`] && (
                    <div style={{ borderTop: `1px solid ${C.border}`, padding: 'clamp(10px,1.4vw,14px) clamp(10px,1.5vw,18px)', background: '#FFF8F3', border: `1px solid ${C.orange}`, borderTop: 'none', borderRadius: '0 0 clamp(5px,.8vw,8px) clamp(5px,.8vw,8px)', marginBottom: 3 }}>
                      {[['Parent', bk.parent_name], ['Teacher', bk.teacher_name], ['Slot', bk.start_time ? `${fmt(bk.start_time)} – ${fmt(bk.end_time)}` : '—'], ['Status', bk.status]].map(([label, val]) => (
                        <div key={label} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
                          <div style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: C.grey, minWidth: 56 }}>{label}</div>
                          <div style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: C.navy, fontWeight: 600 }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom bar */}
        <div style={{ padding: 'clamp(8px,1.2vw,14px) clamp(10px,1.5vw,18px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.bg, borderTop: `1px solid ${C.border}`, flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 'clamp(13px,1.6vw,17px)', fontWeight: 700, color: C.navy }}>{totalBookings} booking{totalBookings !== 1 ? 's' : ''} · {totalSlots} slot{totalSlots !== 1 ? 's' : ''}</div>
            <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: C.grey, marginTop: 1 }}>{teachers.length} teacher{teachers.length !== 1 ? 's' : ''} · {fillRate}% fill rate</div>
          </div>
          <button onClick={() => showToast('Coming soon')} style={{ fontSize: 'clamp(12px,1.4vw,15px)', fontWeight: 700, background: C.orange, color: '#fff', border: 'none', borderRadius: 8, padding: 'clamp(8px,1.2vw,11px) clamp(18px,2vw,24px)', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add teacher</button>
        </div>
      </div>
      <Toast msg={toast} />
    </div>
  )
}
