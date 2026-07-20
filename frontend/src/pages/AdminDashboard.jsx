import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import { LOGO_SMALL } from '../assets/logos'
import { titleName } from '../utils/teacherTitle'
import { getTeacherSlots, updateTeacher, cancelSlot, blockSlot, unblockSlot, batchSlotAction } from '../api/admin'
import { wipeBookings, resetSlots, getChangelog } from '../api/demo'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' })
api.interceptors.request.use(cfg => { const t = localStorage.getItem('token'); if (t) cfg.headers.Authorization = `Bearer ${t}`; return cfg })
const getAllBookings = () => api.get('/bookings/all').then(r => r.data)
const getAllSlots = () => api.get('/slots/all').then(r => r.data)
const getUnbookedParents = () => api.get('/admin/unbooked-parents').then(r => r.data)

const fmt = iso => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
const fmtDate = iso => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

export default function AdminDashboard() {
  const { user, logoutUser } = useAuth()
  const [bookings, setBookings] = useState([])
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('o')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const [openTeacher, setOpenTeacher] = useState(null)
  const [openBooking, setOpenBooking] = useState(null)
  const [manageTeacher, setManageTeacher] = useState(null)
  const [manageForm, setManageForm] = useState({ name: '', email: '', subject: '', venue: '' })
  const [manageSlots, setManageSlots] = useState([])
  const [loadingMSlots, setLoadingMSlots] = useState(false)
  const [savingTeacher, setSavingTeacher] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(null)
  const [mBulkSel, setMBulkSel] = useState(new Set())
  const [mLastSel, setMLastSel] = useState(null)
  const [mBulkCancelConfirm, setMBulkCancelConfirm] = useState(0)
  const [mBulking, setMBulking] = useState(false)
  const [mSelectMode, setMSelectMode] = useState(false)
  const [teacherSearch, setTeacherSearch] = useState('')
  const [unbooked, setUnbooked] = useState({ count: 0, parents: [] })
  const [demoLog, setDemoLog] = useState([])           // terminal output lines
  const [demoBusy, setDemoBusy] = useState(false)
  const [demoConfirm, setDemoConfirm] = useState(null) // 'wipe' | 'reset' | null
  const [changelog, setChangelog] = useState(null)
  const [gitOpen, setGitOpen] = useState(false)
  const mMouseDown = useRef(false)
  const mDragAnchor = useRef(null)
  const mDragMoved = useRef(false)
  const mLongPress = useRef(null)
  const mLongPressFired = useRef(false)

  useEffect(() => { fetchData() }, [])
  useEffect(() => {
    if (!document.getElementById('custom-scroll-style')) {
      const s = document.createElement('style')
      s.id = 'custom-scroll-style'
      s.textContent = `.custom-scroll::-webkit-scrollbar{width:3px;height:3px}.custom-scroll::-webkit-scrollbar-track{background:transparent}.custom-scroll::-webkit-scrollbar-thumb{background:#F4C099;border-radius:2px}.custom-scroll::-webkit-scrollbar-thumb:hover{background:#F47920}`
      document.head.appendChild(s)
    }
  }, [])
  useEffect(() => {
    const onUp = () => { mMouseDown.current = false }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [])

  const fetchData = async () => {
    try {
      const [b, s, u] = await Promise.all([getAllBookings(), getAllSlots(), getUnbookedParents()])
      setBookings(b); setSlots(s); setUnbooked(u)
    }
    catch { showToast('Failed to load data') }
    setLoading(false)
  }

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  // --- Demo control panel ---
  const demoPrint = (text, type = 'info') => setDemoLog(l => [...l, { type, text }])
  const runDemoAction = async (kind) => {
    setDemoConfirm(null)
    setDemoBusy(true)
    try {
      if (kind === 'wipe') {
        demoPrint('$ wipe-bookings')
        const r = await wipeBookings()
        demoPrint(`Deleted ${r.deleted} booking${r.deleted !== 1 ? 's' : ''}.`, 'success')
      } else {
        demoPrint('$ reset-slots')
        const r = await resetSlots()
        demoPrint(`Removed ${r.slots_deleted} old slots. Created ${r.slots_created} fresh slots across ${r.teachers} teachers.`, 'success')
      }
      await fetchData()
    } catch (err) {
      demoPrint(err.response?.data?.detail || 'Action failed.', 'error')
    }
    setDemoBusy(false)
  }
  useEffect(() => {
    if (tab === 'demo' && changelog === null) {
      getChangelog().then(setChangelog).catch(() => setChangelog({ days: [], total: 0, error: true }))
    }
  }, [tab, changelog])

  const teacherMap = {}
  slots.forEach(s => {
    const key = s.teacher_name
    if (!teacherMap[key]) teacherMap[key] = { id: s.teacher_id, name: key, email: s.teacher_email || '', venue: s.venue || '', sub: s.subject || '', slots: [], booked: 0 }
    teacherMap[key].slots.push(s)
    if (s.booked_count > 0) teacherMap[key].booked += s.booked_count
  })
  const teachers = Object.values(teacherMap).sort((a,b) => a.name.localeCompare(b.name))
  const filteredTeachers = teachers.filter(t => {
    if (!teacherSearch) return true
    const q = teacherSearch.toLowerCase()
    return t.name.toLowerCase().includes(q) || (t.sub && t.sub.toLowerCase().includes(q))
  })
  const totalBookings = bookings.filter(b => b.status !== 'cancelled').length
  const totalSlots = slots.length
  const avgFill = teachers.length > 0 ? Math.round(teachers.reduce((sum,t) => sum + (t.slots.length > 0 ? t.booked/t.slots.length*100 : 0), 0) / teachers.length) : 0

  const filteredBookings = bookings.filter(b => {
    const q = search.toLowerCase()
    return b.student_name?.toLowerCase().includes(q) || b.parent_name?.toLowerCase().includes(q) || b.teacher_name?.toLowerCase().includes(q)
  })

  const getInit = name => name.replace(/^(Ms\.|Mr\.|Dr\.)/,'').trim().split(' ').filter(Boolean).map(w=>w[0]).join('').slice(0,2).toUpperCase()

  const parentBookings = {}
  bookings.forEach(b => { if (!parentBookings[b.student_name]) parentBookings[b.student_name] = []; parentBookings[b.student_name].push(b) })

  const openManage = async (t) => {
    setManageTeacher(t)
    setManageForm({ name: t.name || '', email: t.email || '', subject: t.sub || '', venue: t.venue || '' })
    setConfirmCancel(null)
    setMBulkSel(new Set()); setMLastSel(null); setMBulkCancelConfirm(0); setMSelectMode(false)
    setLoadingMSlots(true)
    try { setManageSlots(await getTeacherSlots(t.id)) } catch { showToast('Failed to load slots') }
    setLoadingMSlots(false)
  }
  const reloadManageSlots = async () => {
    if (!manageTeacher) return
    try { setManageSlots(await getTeacherSlots(manageTeacher.id)) } catch { /* keep stale */ }
  }
  const saveTeacher = async () => {
    if (!manageForm.name || !manageForm.email) { showToast('Name and email are required'); return }
    setSavingTeacher(true)
    try { await updateTeacher(manageTeacher.id, manageForm); showToast('Teacher updated'); await fetchData() }
    catch (err) { showToast(err.response?.data?.detail || 'Failed to save') }
    setSavingTeacher(false)
  }
  const doCancelSlot = async (slot) => {
    setConfirmCancel(null)
    try { const r = await cancelSlot(slot.id); showToast(r.cancelled_booking ? 'Meeting cancelled & slot removed' : 'Slot removed'); await reloadManageSlots(); await fetchData() }
    catch (err) { showToast(err.response?.data?.detail || 'Failed to cancel slot') }
  }
  const onCancelSlotClick = (slot) => { slot.state === 'booked' ? setConfirmCancel(slot) : doCancelSlot(slot) }
  const toggleBlock = async (slot) => {
    try { await (slot.state === 'blocked' ? unblockSlot(slot.id) : blockSlot(slot.id)); await reloadManageSlots(); await fetchData() }
    catch (err) { showToast(err.response?.data?.detail || 'Failed') }
  }

  const ADMIN_ACTION_PAST = { block: 'blocked', unblock: 'unblocked', cancel: 'cancelled' }
  const handleManageBulkAction = async (action) => {
    const ids = [...mBulkSel]
    if (ids.length === 0 || mBulking) return
    if (action === 'cancel') {
      const bookedCount = ids.filter(id => manageSlots.find(s => s.id === id)?.state === 'booked').length
      if (bookedCount > 0 && !mBulkCancelConfirm) { setMBulkCancelConfirm(bookedCount); return }
    }
    setMBulkCancelConfirm(0)
    setMBulking(true)
    try {
      const result = await batchSlotAction(ids, action)
      const n = result.done.length; const sk = result.skipped.length
      showToast(`${n} slot${n !== 1 ? 's' : ''} ${ADMIN_ACTION_PAST[action]}${sk > 0 ? `, ${sk} skipped` : ''}`)
      setMBulkSel(new Set()); setMLastSel(null); setMSelectMode(false)
      await reloadManageSlots(); await fetchData()
    } catch (err) { showToast(err.response?.data?.detail || 'Action failed') }
    setMBulking(false)
  }

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
          {[['o','Overview'],['b','All bookings'],['u',`Hasn't booked${unbooked.count ? ` (${unbooked.count})` : ''}`],['demo','Demo']].map(([key, lbl]) => (
            <div key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: 'clamp(10px,1.5vw,16px)', textAlign: 'center', fontSize: 'clamp(12px,1.5vw,16px)', fontWeight: 600, cursor: 'pointer', color: tab === key ? '#F47920' : '#9CA3AF', borderBottom: `3px solid ${tab === key ? '#F47920' : 'transparent'}`, background: tab === key ? '#FFF8F3' : '#fff', transition: 'all .15s' }}>{lbl}</div>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === 'o' && (
          <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 'clamp(8px,1.2vw,14px) clamp(10px,1.5vw,18px)', borderBottom: '1px solid #F4C099', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'clamp(6px,1vw,10px)', gap: 8 }}>
                <div style={{ fontSize: 'clamp(9px,1.1vw,12px)', fontWeight: 700, color: '#C45A0A', textTransform: 'uppercase', letterSpacing: '.04em' }}>Teachers &amp; fill rate</div>
                <input
                  type="text" placeholder="Search name or subject…" value={teacherSearch} onChange={e => setTeacherSearch(e.target.value)}
                  style={{ padding: 'clamp(5px,.7vw,8px) clamp(10px,1.3vw,14px)', fontSize: 'clamp(11px,1.3vw,14px)', border: '1.5px solid #F4C099', borderRadius: 'clamp(6px,.8vw,10px)', outline: 'none', fontFamily: 'system-ui,sans-serif', color: '#1B3F7A', width: 'clamp(130px,18vw,200px)', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#F47920'} onBlur={e => e.target.style.borderColor = '#F4C099'} />
              </div>
              {loading ? <div style={{ padding: 20, color: '#9CA3AF', textAlign: 'center' }}>Loading…</div>
              : filteredTeachers.length === 0 ? <div style={{ padding: 20, color: '#9CA3AF', textAlign: 'center' }}>{teacherSearch ? 'No teachers match.' : 'No teachers yet'}</div>
              : filteredTeachers.map((t, i) => {
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
                          <button onClick={(e) => { e.stopPropagation(); openManage(t) }} style={{ fontSize: 'clamp(9px,1.1vw,13px)', padding: 'clamp(3px,.5vw,6px) clamp(10px,1.4vw,16px)', borderRadius: 'clamp(5px,.8vw,8px)', cursor: 'pointer', fontWeight: 700, border: 'none', background: '#1B3F7A', color: '#fff', fontFamily: 'inherit' }}>Manage</button>
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
              <input type="text" placeholder="Search student, parent or teacher..." value={search} onChange={e => setSearch(e.target.value)}
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
                const ph = parentBookings[bk.student_name] || []
                return (
                  <div key={bk.id || i}>
                    <div onClick={() => setOpenBooking(isOpen ? null : bk.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'clamp(5px,.8vw,9px) clamp(8px,1.2vw,14px)', borderRadius: isOpen ? 'clamp(5px,.8vw,8px) clamp(5px,.8vw,8px) 0 0' : 'clamp(5px,.8vw,8px)', border: `1px solid ${isOpen ? '#F47920' : '#FDE9D4'}`, marginBottom: isOpen ? 0 : 3, background: isOpen ? '#FFF0E6' : '#FFF8F3', cursor: 'pointer', opacity: isCancelled ? .65 : 1, transition: 'background .15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ minWidth: 48, textAlign: 'center', background: isCancelled ? '#F3F4F6' : '#FFF0E6', borderRadius: 6, padding: '4px 6px', flexShrink: 0 }}>
                          <div style={{ fontSize: 'clamp(10px,1.2vw,14px)', fontWeight: 800, color: isCancelled ? '#9CA3AF' : '#C45A0A', lineHeight: 1.1 }}>{bk.start_time ? fmt(bk.start_time) : '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 'clamp(12px,1.5vw,15px)', fontWeight: 700, color: '#1B3F7A' }}>{bk.student_name}{bk.section ? ` · ${bk.section}` : ''}</div>
                          <div style={{ fontSize: 'clamp(9px,1.1vw,12px)', color: '#9CA3AF' }}>{bk.parent_name ? `${bk.parent_name} · ` : ''}with {titleName(bk.teacher_name)}</div>
                          <div style={{ fontSize: 'clamp(8px,1vw,12px)', marginTop: 1, fontWeight: 600, color: bk.attendance?.length ? '#C45A0A' : '#C4B5A5' }}>{bk.attendance?.length ? `Attended: ${bk.attendance.join(', ')}` : 'Not shown'}</div>
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
                            <div style={{ fontSize: 'clamp(13px,1.6vw,18px)', fontWeight: 700, color: '#1B3F7A' }}>{bk.student_name}{bk.section ? ` · ${bk.section}` : ''}</div>
                            <div style={{ fontSize: 'clamp(9px,1.1vw,13px)', color: '#9CA3AF', marginTop: 2 }}>{bk.parent_name ? `Parent: ${bk.parent_name} · ` : ''}{ph.length} booking{ph.length !== 1 ? 's' : ''}</div>
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

        {/* HASN'T BOOKED YET */}
        {tab === 'u' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: 'clamp(8px,1.2vw,14px) clamp(10px,1.5vw,18px)', borderBottom: '1px solid #F4C099', background: '#FFF8F3', flexShrink: 0 }}>
              <span style={{ fontSize: 'clamp(11px,1.4vw,15px)', color: '#C45A0A', fontWeight: 700 }}>
                {unbooked.count} parent{unbooked.count !== 1 ? 's' : ''} haven't booked
              </span>
            </div>
            <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 'clamp(8px,1.2vw,14px)' }}>
              {loading ? <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
              : unbooked.count === 0 ? (
                <div style={{ textAlign: 'center', color: '#16A34A', fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 600, marginTop: 'clamp(32px,6vw,60px)' }}>
                  All parents have booked 🎉
                </div>
              ) : unbooked.parents.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px,1.2vw,12px)', padding: 'clamp(7px,1vw,11px) clamp(8px,1.2vw,14px)', borderRadius: 'clamp(5px,.8vw,8px)', border: '1px solid #FDE9D4', marginBottom: 3, background: '#FFF8F3' }}>
                  <div style={{ width: 'clamp(26px,3.2vw,38px)', height: 'clamp(26px,3.2vw,38px)', borderRadius: '50%', background: '#FFF0E6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(9px,1.1vw,13px)', fontWeight: 700, color: '#F47920', flexShrink: 0 }}>{getInit(p.parent_name || p.student_name || '?')}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'clamp(12px,1.5vw,15px)', fontWeight: 700, color: '#1B3F7A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.parent_name}{p.student_name && p.student_name !== p.parent_name ? ` · ${p.student_name}` : ''}{p.section ? ` (${p.section})` : ''}
                    </div>
                    <div style={{ fontSize: 'clamp(9px,1.1vw,12px)', color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.email}</div>
                  </div>
                  <span style={{ fontSize: 'clamp(8px,1vw,11px)', padding: '2px clamp(6px,1vw,10px)', borderRadius: 10, background: '#FEF2F2', color: '#B91C1C', fontWeight: 600, flexShrink: 0 }}>No booking</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DEMO */}
        {tab === 'demo' && (
          <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {/* Terminal panel */}
            <div style={{ background: '#1B3F7A', margin: 'clamp(10px,1.5vw,16px)', borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ padding: 'clamp(10px,1.4vw,16px) clamp(12px,1.8vw,20px)', borderBottom: '1px solid rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF6B6B' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FDBA30' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ADE80' }} />
                <span style={{ marginLeft: 8, color: 'rgba(255,255,255,.7)', fontSize: 'clamp(11px,1.3vw,14px)', fontFamily: "'Courier New',monospace" }}>demo control · {user?.name || 'admin'}</span>
              </div>
              <div style={{ padding: 'clamp(12px,1.8vw,20px)', minHeight: 90, maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }} className="custom-scroll">
                {demoLog.length === 0 && <div style={{ color: 'rgba(255,255,255,.5)', fontFamily: "'Courier New',monospace", fontSize: 'clamp(12px,1.4vw,14px)' }}>Ready. Pick an action below.</div>}
                {demoLog.map((entry, i) => (
                  <div key={i} style={{ fontFamily: "'Courier New',monospace", fontSize: 'clamp(12px,1.4vw,14px)', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: entry.type === 'success' ? '#4ADE80' : entry.type === 'error' ? '#FF6B6B' : 'rgba(255,255,255,.85)' }}>{entry.text}</div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ padding: '0 clamp(10px,1.5vw,16px)', display: 'flex', gap: 'clamp(8px,1.2vw,14px)', flexWrap: 'wrap', flexShrink: 0 }}>
              <button onClick={() => setDemoConfirm('wipe')} disabled={demoBusy}
                style={{ flex: '1 1 200px', padding: 'clamp(12px,1.6vw,16px)', borderRadius: 12, border: '1.5px solid #FCA5A5', background: '#FEF2F2', color: '#B91C1C', fontWeight: 700, fontSize: 'clamp(13px,1.6vw,16px)', cursor: demoBusy ? 'default' : 'pointer', opacity: demoBusy ? .6 : 1, fontFamily: 'inherit' }}>Wipe all bookings</button>
              <button onClick={() => setDemoConfirm('reset')} disabled={demoBusy}
                style={{ flex: '1 1 200px', padding: 'clamp(12px,1.6vw,16px)', borderRadius: 12, border: '1.5px solid #F4C099', background: '#fff', color: '#C45A0A', fontWeight: 700, fontSize: 'clamp(13px,1.6vw,16px)', cursor: demoBusy ? 'default' : 'pointer', opacity: demoBusy ? .6 : 1, fontFamily: 'inherit' }}>Reset slots</button>
            </div>

            {/* What's new */}
            <div style={{ padding: 'clamp(14px,2vw,20px) clamp(14px,2vw,22px)' }}>
              <div style={{ fontSize: 'clamp(11px,1.3vw,14px)', fontWeight: 800, color: '#C45A0A', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 'clamp(8px,1.2vw,12px)' }}>What's new</div>
              {changelog === null ? <div style={{ color: '#9CA3AF', fontSize: 14 }}>Loading changelog…</div>
              : changelog.error ? <div style={{ color: '#9CA3AF', fontSize: 14 }}>Changelog unavailable.</div>
              : (<>
                {/* Hand-written, teacher-facing notes (primary) */}
                {(changelog.notes || []).length === 0
                  ? <div style={{ color: '#9CA3AF', fontSize: 14 }}>No release notes yet.</div>
                  : (changelog.notes || []).map((sec, si) => (
                    <div key={si} style={{ marginBottom: 'clamp(12px,1.8vw,18px)' }}>
                      <div style={{ fontSize: 'clamp(12px,1.5vw,16px)', fontWeight: 800, color: '#1B3F7A', marginBottom: 6 }}>{sec.heading}</div>
                      {sec.items.map((it, ii) => (
                        <div key={ii} style={{ display: 'flex', gap: 8, padding: '3px 0', fontSize: 'clamp(12px,1.4vw,15px)', color: '#374151', lineHeight: 1.45 }}>
                          <span style={{ color: '#F47920', flexShrink: 0, fontWeight: 800 }}>•</span>
                          <span style={{ minWidth: 0 }}>{it}</span>
                        </div>
                      ))}
                    </div>
                  ))}

                {/* Git commits (secondary, collapsed) */}
                <div style={{ marginTop: 'clamp(8px,1.2vw,14px)', borderTop: '1px solid #F4EDE4', paddingTop: 'clamp(8px,1.2vw,12px)' }}>
                  <button onClick={() => setGitOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: 'clamp(10px,1.2vw,13px)', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    <span style={{ display: 'inline-block', transition: 'transform .15s', transform: gitOpen ? 'rotate(90deg)' : 'none' }}>▸</span>
                    Developer changelog (git){changelog.total ? ` · ${changelog.total}` : ''}
                  </button>
                  {gitOpen && (
                    <div style={{ marginTop: 'clamp(8px,1.2vw,12px)' }}>
                      {changelog.git_error ? <div style={{ color: '#9CA3AF', fontSize: 13 }}>Git log unavailable.</div>
                      : changelog.days.length === 0 ? <div style={{ color: '#9CA3AF', fontSize: 13 }}>No commits in the last 7 days.</div>
                      : changelog.days.map(day => (
                        <div key={day.date} style={{ marginBottom: 'clamp(8px,1.2vw,14px)' }}>
                          <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', fontWeight: 700, color: '#1B3F7A', marginBottom: 4 }}>{day.date}</div>
                          {day.commits.map((c, i) => (
                            <div key={i} style={{ display: 'flex', gap: 10, padding: '3px 0', fontSize: 'clamp(10px,1.2vw,13px)' }}>
                              <code style={{ color: '#C45A0A', fontFamily: "'Courier New',monospace", flexShrink: 0 }}>{c.hash}</code>
                              <span style={{ color: '#6B7280', minWidth: 0 }}>{c.message}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>)}
            </div>
          </div>
        )}

        {/* BOTTOM BAR */}
        <div style={{ padding: 'clamp(8px,1.2vw,14px) clamp(10px,1.5vw,18px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF8F3', borderTop: '1px solid #F4C099', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 'clamp(11px,1.4vw,16px)', color: '#C45A0A', fontWeight: 500 }}>{totalBookings} bookings · 09 Apr 2026</span>
        </div>
      </div>

      {/* MANAGE TEACHER MODAL */}
      {manageTeacher && (
        <div onClick={() => setManageTeacher(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16, backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 'min(520px,calc(100vw - 24px))', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 16px 50px rgba(0,0,0,.2)' }}>
            <div style={{ padding: 'clamp(16px,2.2vw,22px)', background: '#F47920', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontSize: 'clamp(15px,2vw,20px)', fontWeight: 800, color: '#fff' }}>Manage teacher</div>
              <button onClick={() => setManageTeacher(null)} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: '50%', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <div className="custom-scroll" style={{ overflowY: 'auto', padding: 'clamp(16px,2.2vw,24px)', display: 'flex', flexDirection: 'column', gap: 'clamp(14px,2vw,20px)' }}>
              {/* Editable details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[['Name', 'name'], ['Email', 'email'], ['Subject', 'subject'], ['Venue', 'venue']].map(([lbl, key]) => (
                  <div key={key}>
                    <label style={{ fontSize: 'clamp(10px,1.2vw,12px)', fontWeight: 700, color: '#C45A0A', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 }}>{lbl}</label>
                    <input value={manageForm[key]} onChange={e => setManageForm(f => ({ ...f, [key]: e.target.value }))}
                      style={{ width: '100%', padding: 'clamp(9px,1.2vw,12px)', fontSize: 'clamp(13px,1.5vw,15px)', border: '1.5px solid #F4C099', borderRadius: 10, outline: 'none', fontFamily: 'inherit', color: '#1B3F7A', boxSizing: 'border-box' }}
                      onFocus={e => e.target.style.borderColor = '#F47920'} onBlur={e => e.target.style.borderColor = '#F4C099'} />
                  </div>
                ))}
                <button onClick={saveTeacher} disabled={savingTeacher} style={{ alignSelf: 'flex-start', fontSize: 'clamp(12px,1.4vw,15px)', fontWeight: 700, padding: 'clamp(8px,1.1vw,12px) clamp(18px,2.4vw,28px)', borderRadius: 10, background: '#1B3F7A', color: '#fff', border: 'none', cursor: savingTeacher ? 'not-allowed' : 'pointer', opacity: savingTeacher ? .6 : 1, fontFamily: 'inherit' }}>{savingTeacher ? 'Saving…' : 'Save'}</button>
              </div>

              {/* Slot list */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 'clamp(10px,1.2vw,12px)', fontWeight: 700, color: '#C45A0A', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    Slots{mBulkSel.size > 0 ? ` · ${mBulkSel.size} selected` : ''}
                  </div>
                  {mBulkSel.size > 0 && (
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                      {[['block','Block'],['unblock','Unblock'],['cancel','Remove']].map(([action, label]) => (
                        <button key={action} disabled={mBulking} onClick={() => handleManageBulkAction(action)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 50, cursor: mBulking ? 'default' : 'pointer', fontWeight: 600, border: action === 'cancel' ? '1.5px solid #FCA5A5' : '1.5px solid #F4C099', background: action === 'cancel' ? '#FEF2F2' : '#fff', color: action === 'cancel' ? '#B91C1C' : '#1B3F7A', fontFamily: 'inherit', opacity: mBulking ? .6 : 1 }}>{label}</button>
                      ))}
                      <button onClick={() => { setMBulkSel(new Set()); setMLastSel(null); setMSelectMode(false) }} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 50, cursor: 'pointer', fontWeight: 700, border: '1.5px solid #E5D5C5', background: '#fff', color: '#9CA3AF', fontFamily: 'inherit' }}>Done</button>
                    </div>
                  )}
                </div>
                {loadingMSlots ? <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
                : manageSlots.length === 0 ? <div style={{ padding: 16, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>No slots</div>
                : manageSlots.map((s, idx) => {
                  const isMSel = mBulkSel.has(s.id)
                  const inMSelect = mSelectMode || mBulkSel.size > 0
                  return (
                    <div
                      key={s.id}
                      onClick={(e) => {
                        if (mDragMoved.current) { mDragMoved.current = false; return }
                        // A long-press already selected this slot; swallow the click that follows it.
                        if (mLongPressFired.current) { mLongPressFired.current = false; return }
                        if (inMSelect) {
                          if (e.shiftKey && mLastSel !== null) {
                            const lo = Math.min(mLastSel, idx); const hi = Math.max(mLastSel, idx)
                            setMBulkSel(prev => { const n = new Set(prev); manageSlots.slice(lo, hi + 1).forEach(sl => n.add(sl.id)); return n })
                          } else {
                            setMBulkSel(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n })
                            setMLastSel(idx)
                          }
                          return
                        }
                        if (e.shiftKey && mLastSel !== null) {
                          const lo = Math.min(mLastSel, idx); const hi = Math.max(mLastSel, idx)
                          setMBulkSel(prev => { const n = new Set(prev); manageSlots.slice(lo, hi + 1).forEach(sl => n.add(sl.id)); return n })
                          setMSelectMode(true)
                        } else {
                          setMBulkSel(new Set([s.id]))
                          setMLastSel(idx)
                          setMSelectMode(true)
                        }
                      }}
                      onMouseDown={(e) => { if (e.button !== 0) return; mMouseDown.current = true; mDragAnchor.current = idx; mDragMoved.current = false }}
                      onMouseEnter={() => {
                        if (!mMouseDown.current || mDragAnchor.current === null || mDragAnchor.current === idx) return
                        mDragMoved.current = true
                        if (!mSelectMode) setMSelectMode(true)
                        const lo = Math.min(mDragAnchor.current, idx); const hi = Math.max(mDragAnchor.current, idx)
                        setMBulkSel(prev => { const n = new Set(prev); manageSlots.slice(lo, hi + 1).forEach(sl => n.add(sl.id)); return n })
                      }}
                      onTouchStart={() => { mLongPress.current = setTimeout(() => { if (!mSelectMode) { mLongPressFired.current = true; setMSelectMode(true); setMBulkSel(new Set([s.id])); setMLastSel(idx) } }, 500) }}
                      onTouchEnd={() => { clearTimeout(mLongPress.current) }}
                      onTouchMove={() => { clearTimeout(mLongPress.current) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: 'clamp(7px,1vw,10px) 0', borderBottom: '1px solid #F4EDE4', cursor: 'pointer', background: isMSel ? '#EFF6FF' : '#fff', borderLeft: isMSel ? '3px solid #1B3F7A' : '3px solid transparent', paddingLeft: isMSel ? 4 : 7, userSelect: 'none', transition: 'background .1s' }}
                    >
                      <div style={{ width: 'clamp(56px,7.5vw,72px)', fontSize: 'clamp(12px,1.4vw,15px)', fontWeight: 700, color: s.state === 'blocked' ? '#9CA3AF' : '#1B3F7A', flexShrink: 0 }}>{fmt(s.start_time)}</div>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 'clamp(11px,1.3vw,14px)', color: s.state === 'booked' ? '#1B3F7A' : '#9CA3AF', fontWeight: s.state === 'booked' ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.state === 'booked' ? `Booked — ${s.student_name || s.parent_name}${s.section ? ` (${s.section})` : ''}` : s.state === 'blocked' ? 'Blocked' : 'Free'}
                      </div>
                      {!inMSelect && s.state !== 'booked' && (
                        <button onClick={e => { e.stopPropagation(); toggleBlock(s) }} style={{ fontSize: 'clamp(9px,1.1vw,12px)', fontWeight: 700, padding: 'clamp(4px,.6vw,6px) clamp(8px,1.2vw,12px)', borderRadius: 50, cursor: 'pointer', fontFamily: 'inherit', border: `1.5px solid ${s.state === 'blocked' ? '#9CA3AF' : '#F4C099'}`, background: '#fff', color: s.state === 'blocked' ? '#6B7280' : '#C45A0A', flexShrink: 0 }}>{s.state === 'blocked' ? 'Unblock' : 'Block'}</button>
                      )}
                      {!inMSelect && (
                        <button onClick={e => { e.stopPropagation(); onCancelSlotClick(s) }} style={{ fontSize: 'clamp(9px,1.1vw,12px)', fontWeight: 700, padding: 'clamp(4px,.6vw,6px) clamp(8px,1.2vw,12px)', borderRadius: 50, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid #FCA5A5', background: '#FEF2F2', color: '#B91C1C', flexShrink: 0 }}>Remove slot</button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Booked-slot cancel confirm (single) */}
          {confirmCancel && (
            <div onClick={e => { e.stopPropagation(); setConfirmCancel(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 210, padding: 20 }}>
              <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 'clamp(20px,3vw,32px)', width: '100%', maxWidth: 'min(360px,calc(100vw - 32px))', textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,.18)' }}>
                <div style={{ fontSize: 'clamp(15px,2vw,20px)', fontWeight: 700, color: '#1B3F7A', marginBottom: 10 }}>Cancel this meeting?</div>
                <div style={{ fontSize: 'clamp(12px,1.5vw,15px)', color: '#9CA3AF', marginBottom: 'clamp(18px,2.5vw,26px)', lineHeight: 1.5 }}>This will cancel {confirmCancel.student_name || confirmCancel.parent_name}'s meeting. Continue?</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={() => setConfirmCancel(null)} style={{ flex: 1, padding: 'clamp(10px,1.4vw,14px)', borderRadius: 12, fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 700, cursor: 'pointer', border: '2px solid #F4C099', background: '#fff', color: '#9CA3AF', fontFamily: 'inherit' }}>Back</button>
                  <button onClick={() => doCancelSlot(confirmCancel)} style={{ flex: 1, padding: 'clamp(10px,1.4vw,14px)', borderRadius: 12, fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 700, cursor: 'pointer', border: 'none', background: '#B91C1C', color: '#fff', fontFamily: 'inherit' }}>Continue</button>
                </div>
              </div>
            </div>
          )}

          {/* Bulk cancel confirm */}
          {mBulkCancelConfirm > 0 && (
            <div onClick={e => { e.stopPropagation(); setMBulkCancelConfirm(0) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 210, padding: 20 }}>
              <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 'clamp(20px,3vw,32px)', width: '100%', maxWidth: 'min(360px,calc(100vw - 32px))', textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,.18)' }}>
                <div style={{ fontSize: 'clamp(15px,2vw,20px)', fontWeight: 700, color: '#1B3F7A', marginBottom: 10 }}>Cancel {mBulkSel.size} slot{mBulkSel.size !== 1 ? 's' : ''}?</div>
                <div style={{ fontSize: 'clamp(12px,1.5vw,15px)', color: '#9CA3AF', marginBottom: 'clamp(18px,2.5vw,26px)', lineHeight: 1.5 }}>This will cancel {mBulkCancelConfirm} parent meeting{mBulkCancelConfirm !== 1 ? 's' : ''} and remove the slots. Continue?</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={() => setMBulkCancelConfirm(0)} style={{ flex: 1, padding: 'clamp(10px,1.4vw,14px)', borderRadius: 12, fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 700, cursor: 'pointer', border: '2px solid #F4C099', background: '#fff', color: '#9CA3AF', fontFamily: 'inherit' }}>Back</button>
                  <button onClick={() => handleManageBulkAction('cancel')} style={{ flex: 1, padding: 'clamp(10px,1.4vw,14px)', borderRadius: 12, fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 700, cursor: 'pointer', border: 'none', background: '#B91C1C', color: '#fff', fontFamily: 'inherit' }}>Remove slots</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DEMO CONFIRM */}
      {demoConfirm && (
        <div onClick={() => setDemoConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20, backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 'clamp(22px,3vw,34px)', width: '100%', maxWidth: 'min(400px,calc(100vw - 32px))', textAlign: 'center', boxShadow: '0 16px 50px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize: 'clamp(16px,2.1vw,22px)', fontWeight: 800, color: '#1B3F7A', marginBottom: 10 }}>
              {demoConfirm === 'wipe' ? 'Wipe all bookings?' : 'Reset all slots?'}
            </div>
            <div style={{ fontSize: 'clamp(12px,1.5vw,15px)', color: '#9CA3AF', marginBottom: 'clamp(18px,2.5vw,26px)', lineHeight: 1.5 }}>
              {demoConfirm === 'wipe'
                ? 'This permanently deletes EVERY booking (including cancelled meetings and blocked slots) for your school. Slots stay; they just become free.'
                : 'This deletes ALL slots for your school (and any bookings on them) and regenerates a fresh 45-slot grid per teacher. This cannot be undone.'}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDemoConfirm(null)} style={{ flex: 1, padding: 'clamp(11px,1.5vw,15px)', borderRadius: 12, fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 700, cursor: 'pointer', border: '2px solid #F4C099', background: '#fff', color: '#9CA3AF', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => runDemoAction(demoConfirm)} style={{ flex: 1, padding: 'clamp(11px,1.5vw,15px)', borderRadius: 12, fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 700, cursor: 'pointer', border: 'none', background: '#B91C1C', color: '#fff', fontFamily: 'inherit' }}>{demoConfirm === 'wipe' ? 'Wipe bookings' : 'Reset slots'}</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      <div style={{ position: 'fixed', bottom: 'clamp(16px,2.5vw,28px)', left: '50%', transform: 'translateX(-50%)', background: '#FFF0E6', border: '1px solid #F4C099', color: '#C45A0A', fontSize: 'clamp(11px,1.4vw,15px)', padding: 'clamp(6px,1vw,10px) clamp(14px,2vw,20px)', borderRadius: 20, fontWeight: 500, opacity: toast ? 1 : 0, transition: 'opacity .3s', pointerEvents: 'none', zIndex: 999, whiteSpace: 'nowrap' }}>{toast}</div>
    </div>
  )
}
