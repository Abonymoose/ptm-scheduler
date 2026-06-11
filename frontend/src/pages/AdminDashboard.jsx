import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import { LOGO_SMALL } from '../assets/logos'
import { titleName } from '../utils/teacherTitle'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' })
api.interceptors.request.use(cfg => { const t = localStorage.getItem('token'); if (t) cfg.headers.Authorization = `Bearer ${t}`; return cfg })
const getAllBookings = () => api.get('/bookings/all').then(r => r.data)
const getAllSlots = () => api.get('/slots/all').then(r => r.data)

const fmt = iso => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
const fmtDate = iso => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

export default function AdminDashboard() {
  const { logoutUser } = useAuth()
  const [bookings, setBookings] = useState([])
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('o')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const [openTeacher, setOpenTeacher] = useState(null)
  const [openBooking, setOpenBooking] = useState(null)
  const [termLog, setTermLog] = useState([{ type: 'info', text: 'PTM Admin Terminal v1.0 — type "help" for commands' }])
  const [termInput, setTermInput] = useState('')
  const terminalRef = useRef(null)

  useEffect(() => { fetchData() }, [])
  useEffect(() => {
    if (!document.getElementById('custom-scroll-style')) {
      const s = document.createElement('style')
      s.id = 'custom-scroll-style'
      s.textContent = `.custom-scroll::-webkit-scrollbar{width:3px;height:3px}.custom-scroll::-webkit-scrollbar-track{background:transparent}.custom-scroll::-webkit-scrollbar-thumb{background:#F4C099;border-radius:2px}.custom-scroll::-webkit-scrollbar-thumb:hover{background:#F47920}`
      document.head.appendChild(s)
    }
  }, [])

  const fetchData = async () => {
    try { const [b, s] = await Promise.all([getAllBookings(), getAllSlots()]); setBookings(b); setSlots(s) }
    catch { showToast('Failed to load data') }
    setLoading(false)
  }

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const teacherMap = {}
  slots.forEach(s => {
    const key = s.teacher_name
    if (!teacherMap[key]) teacherMap[key] = { name: key, email: s.teacher_email || '', venue: s.venue || '', sub: s.subject || '', slots: [], booked: 0 }
    teacherMap[key].slots.push(s)
    if (s.booked_count > 0) teacherMap[key].booked += s.booked_count
  })
  const teachers = Object.values(teacherMap).sort((a,b) => a.name.localeCompare(b.name))
  const totalBookings = bookings.filter(b => b.status !== 'cancelled').length
  const totalSlots = slots.length
  const avgFill = teachers.length > 0 ? Math.round(teachers.reduce((sum,t) => sum + (t.slots.length > 0 ? t.booked/t.slots.length*100 : 0), 0) / teachers.length) : 0

  const filteredBookings = bookings.filter(b => {
    const q = search.toLowerCase()
    return b.parent_name?.toLowerCase().includes(q) || b.teacher_name?.toLowerCase().includes(q)
  })

  const getInit = name => name.replace(/^(Ms\.|Mr\.|Dr\.)/,'').trim().split(' ').filter(Boolean).map(w=>w[0]).join('').slice(0,2).toUpperCase()

  const termScroll = () => setTimeout(() => terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight, behavior: 'smooth' }), 0)

  const runTermCmd = async (raw) => {
    const line = raw.trim()
    if (!line) return
    setTermLog(l => [...l, { type: 'info', text: `> ${line}` }]); termScroll()
    const parts = line.split(' ')
    const cmd = parts[0].toLowerCase()
    if (cmd === 'help') {
      setTermLog(l => [...l,
        { type: 'info', text: 'add teacher [name] [email]  — add a teacher' },
        { type: 'info', text: 'remove teacher [email]      — remove a teacher' },
        { type: 'info', text: 'add slots [email] [count]   — add slots to teacher' },
        { type: 'info', text: 'help                        — list commands' },
      ]); termScroll()
    } else if (cmd === 'add' && parts[1] === 'teacher') {
      const name = parts.slice(2, parts.length - 1).join(' ')
      const email = parts[parts.length - 1]
      if (!name || !email || !email.includes('@')) { setTermLog(l => [...l, { type: 'error', text: 'Usage: add teacher [name] [email]' }]); termScroll(); return }
      try {
        await api.post('/auth/register', { name, email, password: 'teacher123', role: 'teacher' })
        setTermLog(l => [...l, { type: 'success', text: `✓ Teacher added: ${name} <${email}>` }])
      } catch (err) {
        setTermLog(l => [...l, { type: 'error', text: `Error: ${err.response?.data?.detail || err.message}` }])
      }
      termScroll()
    } else if (cmd === 'remove' && parts[1] === 'teacher') {
      const email = parts[2]
      if (!email || !email.includes('@')) { setTermLog(l => [...l, { type: 'error', text: 'Usage: remove teacher [email]' }]); termScroll(); return }
      setTermLog(l => [...l, { type: 'info', text: 'Coming soon — not yet implemented' }]); termScroll()
    } else if (cmd === 'add' && parts[1] === 'slots') {
      const email = parts[2]; const count = parseInt(parts[3])
      if (!email || !email.includes('@') || isNaN(count) || count < 1) { setTermLog(l => [...l, { type: 'error', text: 'Usage: add slots [email] [count]' }]); termScroll(); return }
      setTermLog(l => [...l, { type: 'info', text: 'Coming soon — not yet implemented' }]); termScroll()
    } else {
      setTermLog(l => [...l, { type: 'error', text: `Unknown command: "${cmd}". Type "help" for commands.` }]); termScroll()
    }
  }

  const parentBookings = {}
  bookings.forEach(b => { if (!parentBookings[b.parent_name]) parentBookings[b.parent_name] = []; parentBookings[b.parent_name].push(b) })

  return (
    <div style={{ background: '#FFF8F3', minHeight: '100svh', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: '#fff', border: '1px solid #F4C099', borderRadius: 'clamp(10px,1.5vw,18px)', overflow: 'hidden', width: 'min(96vw,860px)', margin: 'clamp(10px,2vw,24px) auto', display: 'flex', flexDirection: 'column', height: 'calc(100svh - clamp(20px,4vw,40px))' }}>

        {/* TOPBAR */}
        <div style={{ padding: 'clamp(8px,1.2vw,16px) clamp(12px,2vw,24px)', background: '#F47920', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px,1.2vw,16px)' }}>
            <div style={{ width: 'clamp(28px,3.5vw,44px)', height: 'clamp(28px,3.5vw,44px)', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(9px,1.1vw,13px)', fontWeight: 700, color: '#F47920', flexShrink: 0 }}>AD</div>
            <div>
              <div style={{ fontSize: 'clamp(12px,1.5vw,18px)', fontWeight: 600, color: '#fff' }}>Inventure Academy</div>
              <div style={{ fontSize: 'clamp(9px,1.1vw,13px)', color: '#FFE0C0' }}>Admin · PTM 09 Apr 2026</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px,1.2vw,14px)' }}>
            <button onClick={() => {}} title="Coming soon" style={{ fontSize: 'clamp(11px,1.4vw,15px)', fontWeight: 700, padding: 'clamp(6px,1vw,11px) clamp(12px,1.8vw,20px)', borderRadius: 'clamp(7px,1vw,11px)', background: '#1B3F7A', color: '#fff', cursor: 'not-allowed', opacity: .45, fontFamily: 'inherit', border: '1px solid rgba(255,255,255,.3)' }}>+ Add teacher</button>
            <button onClick={logoutUser} style={{fontSize:'clamp(10px,1.2vw,13px)',fontWeight:600,padding:'clamp(4px,.8vw,8px) clamp(10px,1.5vw,16px)',borderRadius:20,background:'rgba(255,255,255,.2)',border:'1px solid rgba(255,255,255,.4)',color:'#fff',cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>Sign out</button>
            <img src={LOGO_SMALL} style={{ height: 'clamp(28px,3.5vw,44px)', width: 'auto', opacity: .95 }} alt="Inventure" />
          </div>
        </div>

        {/* STATS */}
        <div style={{ display: 'flex', borderBottom: '1px solid #F4C099', flexShrink: 0 }}>
          {[{ label: 'Teachers', value: teachers.length }, { label: 'Bookings', value: totalBookings }, { label: 'Total slots', value: totalSlots }, { label: 'Avg fill rate', value: `${avgFill}%` }].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: 'clamp(6px,1vw,12px) 0', textAlign: 'center', borderRight: i < 3 ? '1px solid #F4C099' : 'none' }}>
              <div style={{ fontSize: 'clamp(16px,2.2vw,26px)', fontWeight: 700, color: '#1B3F7A' }}>{s.value}</div>
              <div style={{ fontSize: 'clamp(8px,1vw,11px)', color: '#9CA3AF', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', borderBottom: '1px solid #F4C099', flexShrink: 0 }}>
          {[['o','Overview'],['b','All bookings'],['t','Terminal']].map(([key, lbl]) => (
            <div key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: 'clamp(10px,1.5vw,16px)', textAlign: 'center', fontSize: 'clamp(12px,1.5vw,16px)', fontWeight: 600, cursor: 'pointer', color: tab === key ? '#F47920' : '#9CA3AF', borderBottom: `3px solid ${tab === key ? '#F47920' : 'transparent'}`, background: tab === key ? '#FFF8F3' : '#fff', transition: 'all .15s' }}>{lbl}</div>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === 'o' && (
          <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 'clamp(8px,1.2vw,14px) clamp(10px,1.5vw,18px)', borderBottom: '1px solid #F4C099', flex: 1 }}>
              <div style={{ fontSize: 'clamp(9px,1.1vw,12px)', fontWeight: 700, color: '#C45A0A', marginBottom: 'clamp(6px,1vw,10px)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Teachers &amp; fill rate</div>
              {loading ? <div style={{ padding: 20, color: '#9CA3AF', textAlign: 'center' }}>Loading…</div>
              : teachers.length === 0 ? <div style={{ padding: 20, color: '#9CA3AF', textAlign: 'center' }}>No teachers yet</div>
              : teachers.map((t, i) => {
                const pct = t.slots.length > 0 ? Math.round(t.booked/t.slots.length*100) : 0
                const isOpen = openTeacher === i
                return (
                  <div key={i} style={{ borderRadius: 'clamp(6px,1vw,10px)', border: '1px solid #FDE9D4', marginBottom: 'clamp(4px,.6vw,7px)', overflow: 'hidden' }}>
                    <div onClick={() => setOpenTeacher(isOpen ? null : i)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'clamp(6px,.9vw,11px) clamp(8px,1.2vw,14px)', background: '#FFF8F3', cursor: 'pointer', userSelect: 'none' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FDE9D4'}
                      onMouseLeave={e => e.currentTarget.style.background = '#FFF8F3'}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px,1vw,10px)' }}>
                        <div style={{ width: 'clamp(22px,2.8vw,34px)', height: 'clamp(22px,2.8vw,34px)', borderRadius: '50%', background: '#FFF0E6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(8px,1vw,12px)', fontWeight: 700, color: '#F47920', flexShrink: 0 }}>{getInit(t.name)}</div>
                        <div>
                          <div style={{ fontSize: 'clamp(11px,1.3vw,15px)', fontWeight: 600, color: '#1B3F7A' }}>{titleName(t.name)}</div>
                          <div style={{ fontSize: 'clamp(8px,1vw,12px)', color: '#9CA3AF' }}>{t.sub && `${t.sub} · `}{t.slots.length} slots</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(5px,.8vw,10px)' }}>
                        <div style={{ width: 'clamp(60px,8vw,100px)', height: 5, background: '#FDE9D4', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: '#F47920', borderRadius: 2, width: `${pct}%` }} />
                        </div>
                        <div style={{ fontSize: 'clamp(10px,1.2vw,14px)', color: '#9CA3AF', minWidth: 32, textAlign: 'right', fontWeight: 600 }}>{pct}%</div>
                        <span style={{ fontSize: 'clamp(14px,1.8vw,20px)', color: '#F47920', display: 'inline-block', transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'none', marginLeft: 4 }}>›</span>
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{ padding: 'clamp(8px,1.2vw,14px)', borderTop: '1px solid #FDE9D4', background: '#fff' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(4px,.6vw,8px)', marginBottom: 'clamp(6px,1vw,10px)' }}>
                          {[['Venue', t.venue || '—'], ['Email', t.email || '—'], ['Booked', `${t.booked} / ${t.slots.length}`], ['Free', t.slots.length - t.booked]].map(([label, val]) => (
                            <div key={label}>
                              <div style={{ fontSize: 'clamp(8px,1vw,11px)', color: '#9CA3AF', marginBottom: 1 }}>{label}</div>
                              <div style={{ fontSize: 'clamp(10px,1.2vw,14px)', color: '#374151' }}>{val}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 'clamp(5px,.8vw,9px)', flexWrap: 'wrap' }}>
                          <button onClick={() => {}} title="Coming soon" style={{ fontSize: 'clamp(9px,1.1vw,13px)', padding: 'clamp(3px,.5vw,6px) clamp(8px,1.2vw,14px)', borderRadius: 'clamp(5px,.8vw,8px)', cursor: 'not-allowed', opacity: .45, fontWeight: 600, border: '1px solid #F47920', background: '#FFF0E6', color: '#C45A0A', fontFamily: 'inherit' }}>View schedule</button>
                          <button onClick={() => {}} title="Coming soon" style={{ fontSize: 'clamp(9px,1.1vw,13px)', padding: 'clamp(3px,.5vw,6px) clamp(8px,1.2vw,14px)', borderRadius: 'clamp(5px,.8vw,8px)', cursor: 'not-allowed', opacity: .45, fontWeight: 600, border: '1px solid #F4C099', background: '#fff', color: '#9CA3AF', fontFamily: 'inherit' }}>Edit</button>
                          <button onClick={() => {}} title="Coming soon" style={{ fontSize: 'clamp(9px,1.1vw,13px)', padding: 'clamp(3px,.5vw,6px) clamp(8px,1.2vw,14px)', borderRadius: 'clamp(5px,.8vw,8px)', cursor: 'not-allowed', opacity: .45, fontWeight: 600, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#B91C1C', fontFamily: 'inherit' }}>Remove</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ALL BOOKINGS */}
        {tab === 'b' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: 'clamp(8px,1.2vw,14px)', borderBottom: '1px solid #F4C099', background: '#FFF8F3', display: 'flex', gap: 8, flexShrink: 0 }}>
              <input type="text" placeholder="Search parent or teacher..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, padding: 'clamp(7px,1vw,12px) clamp(10px,1.5vw,16px)', fontSize: 'clamp(11px,1.4vw,15px)', border: '1.5px solid #F4C099', borderRadius: 'clamp(8px,1vw,12px)', outline: 'none', fontFamily: 'system-ui,sans-serif', color: '#1B3F7A', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#F47920'} onBlur={e => e.target.style.borderColor = '#F4C099'} />
              <button onClick={() => setSearch('')} style={{ fontSize: 'clamp(10px,1.2vw,14px)', fontWeight: 600, padding: 'clamp(5px,.8vw,9px) clamp(10px,1.5vw,16px)', borderRadius: 'clamp(7px,1vw,11px)', background: '#fff', color: '#F47920', border: '1px solid #F4C099', cursor: 'pointer', fontFamily: 'inherit' }}>Filter</button>
            </div>
            <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 'clamp(8px,1.2vw,14px)' }}>
              {loading ? <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
              : filteredBookings.length === 0 ? <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 'clamp(13px,1.6vw,17px)', marginTop: 40 }}>{search ? 'No results.' : 'No bookings yet.'}</div>
              : filteredBookings.map((bk, i) => {
                const isCancelled = bk.status === 'cancelled'
                const isOpen = openBooking === bk.id
                const ph = parentBookings[bk.parent_name] || []
                return (
                  <div key={bk.id || i}>
                    <div onClick={() => setOpenBooking(isOpen ? null : bk.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'clamp(5px,.8vw,9px) clamp(8px,1.2vw,14px)', borderRadius: isOpen ? 'clamp(5px,.8vw,8px) clamp(5px,.8vw,8px) 0 0' : 'clamp(5px,.8vw,8px)', border: `1px solid ${isOpen ? '#F47920' : '#FDE9D4'}`, marginBottom: isOpen ? 0 : 3, background: isOpen ? '#FFF0E6' : '#FFF8F3', cursor: 'pointer', opacity: isCancelled ? .65 : 1, transition: 'background .15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ minWidth: 48, textAlign: 'center', background: isCancelled ? '#F3F4F6' : '#FFF0E6', borderRadius: 6, padding: '4px 6px', flexShrink: 0 }}>
                          <div style={{ fontSize: 'clamp(10px,1.2vw,14px)', fontWeight: 800, color: isCancelled ? '#9CA3AF' : '#C45A0A', lineHeight: 1.1 }}>{bk.start_time ? fmt(bk.start_time) : '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 'clamp(12px,1.5vw,15px)', fontWeight: 700, color: '#1B3F7A' }}>{bk.parent_name}</div>
                          <div style={{ fontSize: 'clamp(9px,1.1vw,12px)', color: '#9CA3AF' }}>with {titleName(bk.teacher_name)}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 'clamp(8px,1vw,12px)', padding: '2px clamp(6px,1vw,10px)', borderRadius: 10, background: isCancelled ? '#F3F4F6' : '#FFF0E6', color: isCancelled ? '#9CA3AF' : '#C45A0A', fontWeight: 600 }}>{isCancelled ? 'Cancelled' : 'Confirmed'}</span>
                        <span style={{ fontSize: 'clamp(14px,1.8vw,20px)', color: '#9CA3AF', display: 'inline-block', transition: 'transform .2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{ background: '#FFF8F3', border: '1px solid #F47920', borderTop: 'none', borderRadius: '0 0 clamp(5px,.8vw,8px) clamp(5px,.8vw,8px)', marginBottom: 3, overflow: 'hidden' }}>
                        <div style={{ padding: 'clamp(8px,1.2vw,14px) clamp(10px,1.5vw,18px)', borderBottom: '1px solid #FDE9D4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: 'clamp(13px,1.6vw,18px)', fontWeight: 700, color: '#1B3F7A' }}>{bk.parent_name}</div>
                            <div style={{ fontSize: 'clamp(9px,1.1vw,13px)', color: '#9CA3AF', marginTop: 2 }}>Parent · {ph.length} booking{ph.length !== 1 ? 's' : ''}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', borderBottom: '1px solid #FDE9D4' }}>
                          {[{ label: 'Bookings', value: ph.filter(b=>b.status!=='cancelled').length }, { label: 'Cancelled', value: ph.filter(b=>b.status==='cancelled').length }, { label: 'Teachers', value: new Set(ph.map(b=>b.teacher_name)).size }].map((s,i) => (
                            <div key={i} style={{ flex: 1, padding: 'clamp(6px,1vw,10px) 0', textAlign: 'center', borderRight: i < 2 ? '1px solid #FDE9D4' : 'none' }}>
                              <div style={{ fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 700, color: '#F47920' }}>{s.value}</div>
                              <div style={{ fontSize: 'clamp(8px,1vw,11px)', color: '#9CA3AF', marginTop: 1 }}>{s.label}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ padding: 'clamp(8px,1.2vw,14px) clamp(10px,1.5vw,18px)' }}>
                          <div style={{ fontSize: 'clamp(9px,1.1vw,12px)', fontWeight: 700, color: '#C45A0A', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 'clamp(6px,1vw,10px)' }}>PTM history</div>
                          {ph.map((b, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'clamp(4px,.7vw,8px) 0', borderBottom: i < ph.length-1 ? '1px solid #FDE9D4' : 'none', fontSize: 'clamp(10px,1.2vw,14px)' }}>
                              <div style={{ color: '#9CA3AF', minWidth: 'clamp(80px,10vw,120px)' }}>{b.start_time ? fmtDate(b.start_time) : '—'}</div>
                              <div style={{ color: '#1B3F7A', fontWeight: 600, flex: 1, padding: '0 clamp(6px,1vw,10px)' }}>{titleName(b.teacher_name)}</div>
                              <span style={{ fontSize: 'clamp(8px,1vw,11px)', fontWeight: 700, padding: '2px clamp(6px,1vw,10px)', borderRadius: 10, background: b.status === 'cancelled' ? '#F3F4F6' : '#DCFCE7', color: b.status === 'cancelled' ? '#9CA3AF' : '#166534' }}>{b.status === 'cancelled' ? 'Cancelled' : 'Attended'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TERMINAL */}
        {tab === 't' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#1B3F7A' }}>
            <div ref={terminalRef} className="custom-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 'clamp(12px,1.8vw,20px) clamp(14px,2vw,22px)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {termLog.map((entry, i) => (
                <div key={i} style={{ fontFamily: "'Courier New',Courier,monospace", fontSize: 'clamp(12px,1.5vw,15px)', lineHeight: 1.6, color: entry.type === 'success' ? '#4ADE80' : entry.type === 'error' ? '#FF6B6B' : 'rgba(255,255,255,.85)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{entry.text}</div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,.12)', padding: 'clamp(10px,1.4vw,16px) clamp(14px,2vw,22px)', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,.2)', flexShrink: 0 }}>
              <span style={{ fontFamily: "'Courier New',Courier,monospace", color: '#F47920', fontSize: 'clamp(12px,1.5vw,15px)', flexShrink: 0 }}>$</span>
              <input
                value={termInput}
                onChange={e => setTermInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { runTermCmd(termInput); setTermInput('') } }}
                placeholder="Type a command..."
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: "'Courier New',Courier,monospace", fontSize: 'clamp(12px,1.5vw,15px)', color: '#fff', caretColor: '#F47920' }}
              />
            </div>
          </div>
        )}

        {/* BOTTOM BAR */}
        <div style={{ padding: 'clamp(8px,1.2vw,14px) clamp(10px,1.5vw,18px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF8F3', borderTop: '1px solid #F4C099', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 'clamp(11px,1.4vw,16px)', color: '#C45A0A', fontWeight: 500 }}>{totalBookings} bookings · 09 Apr 2026</span>
          <button onClick={() => {}} title="Coming soon" style={{ fontSize: 'clamp(11px,1.4vw,15px)', fontWeight: 700, padding: 'clamp(6px,1vw,11px) clamp(12px,1.8vw,20px)', borderRadius: 'clamp(7px,1vw,11px)', background: '#1B3F7A', color: '#fff', border: 'none', cursor: 'not-allowed', opacity: .45, fontFamily: 'inherit' }}>Export report</button>
        </div>
      </div>

      {/* TOAST */}
      <div style={{ position: 'fixed', bottom: 'clamp(16px,2.5vw,28px)', left: '50%', transform: 'translateX(-50%)', background: '#FFF0E6', border: '1px solid #F4C099', color: '#C45A0A', fontSize: 'clamp(11px,1.4vw,15px)', padding: 'clamp(6px,1vw,10px) clamp(14px,2vw,20px)', borderRadius: 20, fontWeight: 500, opacity: toast ? 1 : 0, transition: 'opacity .3s', pointerEvents: 'none', zIndex: 999, whiteSpace: 'nowrap' }}>{toast}</div>
    </div>
  )
}
