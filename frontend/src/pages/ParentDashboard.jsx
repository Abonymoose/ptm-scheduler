import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSlots } from '../api/slots'
import { createBooking, getMyBookings, cancelBooking, autoSchedule } from '../api/bookings'

// ── exact colors from 2_parent_v3.html ──
const S = {
  screen: { background: '#fff', borderRadius: 16, overflow: 'hidden', width: 'min(96vw,960px)', margin: 'clamp(10px,2vw,20px) auto', boxShadow: '0 2px 20px rgba(0,0,0,.06)', display: 'flex', flexDirection: 'column', height: 'calc(100svh - clamp(20px,4vw,40px))' },
  topbar: { padding: 'clamp(12px,1.8vw,20px) clamp(16px,2.5vw,28px)', background: '#F47920', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  avatar: { width: 'clamp(36px,4.5vw,48px)', height: 'clamp(36px,4.5vw,48px)', borderRadius: '50%', background: 'rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(13px,1.6vw,17px)', fontWeight: 700, color: '#fff', flexShrink: 0 },
  topbarName: { fontSize: 'clamp(15px,2vw,22px)', fontWeight: 700, color: '#fff', letterSpacing: '-.03em' },
  topbarSub: { fontSize: 'clamp(10px,1.2vw,13px)', color: 'rgba(255,255,255,.8)', marginTop: 2 },
  logoutBtn: { fontSize: 'clamp(10px,1.2vw,13px)', fontWeight: 600, padding: 'clamp(4px,.8vw,8px) clamp(10px,1.5vw,16px)', borderRadius: 20, background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  mainTabs: { display: 'flex', background: '#fff', borderBottom: '2px solid #F4C099', flexShrink: 0 },
  mainTab: (active) => ({ flex: 1, padding: 'clamp(12px,1.8vw,18px) 8px', textAlign: 'center', fontSize: 'clamp(13px,1.6vw,17px)', fontWeight: 600, cursor: 'pointer', color: active ? '#F47920' : '#C4B5A5', borderBottom: active ? '3px solid #F47920' : '3px solid transparent', marginBottom: -2, transition: 'all .2s', letterSpacing: '-.01em' }),
  childBar: { padding: 'clamp(10px,1.4vw,16px) clamp(16px,2.5vw,28px)', background: '#FFF8F3', borderBottom: '1px solid #F4C099', display: 'flex', alignItems: 'center', gap: 'clamp(8px,1.2vw,14px)', flexWrap: 'nowrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', flexShrink: 0 },
  childLabel: { fontSize: 'clamp(11px,1.3vw,15px)', color: '#9CA3AF', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 },
  autoBtn: { fontSize: 'clamp(11px,1.3vw,15px)', fontWeight: 700, padding: 'clamp(7px,1vw,12px) clamp(12px,1.6vw,20px)', borderRadius: 50, background: '#F47920', color: '#fff', border: 'none', cursor: 'pointer', marginLeft: 'auto', whiteSpace: 'nowrap', boxShadow: '0 2px 12px rgba(244,121,32,.3)', fontFamily: 'inherit', flexShrink: 0 },
  gridWrap: { overflow: 'auto', flex: 1, minHeight: 0 },
  legend: { display: 'flex', gap: 'clamp(10px,1.5vw,18px)', padding: 'clamp(10px,1.4vw,14px) clamp(16px,2.5vw,28px)', borderTop: '1px solid #F4C099', background: '#FFF8F3', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 },
  bar: { padding: 'clamp(12px,1.8vw,18px) clamp(16px,2.5vw,28px)', borderTop: '1px solid #F4C099', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF8F3', flexShrink: 0, flexWrap: 'wrap', gap: 8 },
  cfmBtn: (on) => ({ fontSize: 'clamp(13px,1.8vw,18px)', fontWeight: 700, padding: 'clamp(10px,1.4vw,16px) clamp(16px,3vw,36px)', borderRadius: 50, background: on ? '#F47920' : '#F4C099', color: '#fff', border: 'none', cursor: on ? 'pointer' : 'default', boxShadow: on ? '0 2px 12px rgba(244,121,32,.3)' : 'none', fontFamily: 'inherit' }),
  schedScroll: { overflowY: 'auto', flex: 1, minHeight: 0 },
  meetingItem: (done, current) => ({ display: 'flex', alignItems: 'center', borderBottom: '1px solid #F4EDE4', minHeight: 'clamp(62px,8vw,80px)', background: done ? '#FAFAFA' : current ? '#FFFAF7' : '#fff', borderLeft: current ? '3px solid #F47920' : 'none' }),
  timeCol: { width: 'clamp(60px,8vw,80px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px', flexShrink: 0 },
  colorBar: (on) => ({ width: 3, flexShrink: 0, alignSelf: 'stretch', background: on ? '#F47920' : '#F4C099' }),
  avatarCircle: { width: 'clamp(32px,4vw,44px)', height: 'clamp(32px,4vw,44px)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(11px,1.4vw,16px)', fontWeight: 700, flexShrink: 0, background: '#fff', border: '2px solid #F4C099', color: '#F47920' },
  xBtn: { width: 'clamp(28px,3.5vw,38px)', height: 'clamp(28px,3.5vw,38px)', borderRadius: 8, background: '#fff', border: 'none', color: '#C4B5A5', cursor: 'pointer', fontSize: 'clamp(18px,2.2vw,26px)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 'clamp(14px,2vw,22px)', fontWeight: 300, lineHeight: 1, padding: 0 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20, backdropFilter: 'blur(2px)' },
  modalBox: { background: '#fff', borderRadius: 16, padding: 'clamp(24px,3.5vw,40px)', width: '100%', maxWidth: 'min(380px,calc(100vw - 32px))', textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,.15)' },
  toast: (show) => ({ position: 'fixed', bottom: 'clamp(16px,2.5vw,28px)', left: '50%', transform: 'translateX(-50%)', background: '#1B3F7A', color: '#fff', padding: 'clamp(10px,1.4vw,16px) clamp(18px,2.5vw,28px)', borderRadius: 50, fontSize: 'clamp(13px,1.6vw,17px)', fontWeight: 600, opacity: show ? 1 : 0, transition: 'opacity .3s', pointerEvents: 'none', zIndex: 999, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(27,63,122,.3)', maxWidth: 'calc(100vw - 32px)', textAlign: 'center' }),
}

const TICK = <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><polyline points="2,5 4,7.5 8,2.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
const FAINT_TICK = <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#F4C099" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
const DONE_TICK = <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#F47920" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>

const fmt = iso => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
const initials = name => { if (!name) return '??'; const p = name.split(' ').filter(Boolean); return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0].substring(0, 2).toUpperCase() }

export default function ParentDashboard() {
  const { user, logoutUser } = useAuth()
  const [slots, setSlots] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [activeChild, setActiveChild] = useState('p') // 'p' = Parshv, 'd' = Dhriti
  const [tab, setTab] = useState('book')
  const [hoveredCancel, setHoveredCancel] = useState(null)
  const [autoModal, setAutoModal] = useState(false)
  const [autoScheduling, setAutoScheduling] = useState(false)
  const [autoResult, setAutoResult] = useState(null)
  const [selectedTeachers, setSelectedTeachers] = useState(new Set())
  const [cancelModal, setCancelModal] = useState(null)
  const [done, setDone] = useState({})

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const [s, b] = await Promise.all([getSlots(), getMyBookings()])
      setSlots(s); setBookings(b)
    } catch { showToast('Failed to load data') }
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
    try { await cancelBooking(cancelModal.booking_id); showToast('Meeting cancelled'); fetchData() }
    catch { showToast('Failed to cancel') }
    setCancelModal(null)
  }

  const openAutoModal = () => { setSelectedTeachers(new Set(teacherOptions.map(t => t.id))); setAutoResult(null); setAutoModal(true) }
  const toggleTeacher = id => { setSelectedTeachers(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }

  const handleAutoSchedule = async () => {
    setAutoScheduling(true)
    try { const result = await autoSchedule([...selectedTeachers]); setAutoResult(result); fetchData() }
    catch (err) { showToast(err.response?.data?.detail || 'Auto-schedule failed') }
    setAutoScheduling(false)
  }

  const teacherGroups = groupByTeacher()
  const teachers = Object.keys(teacherGroups)
  const teacherOptions = [...new Map(slots.map(s => [s.teacher_id, s.teacher_name])).entries()].map(([id, name]) => ({ id, name }))
  const allTimes = [...new Set(slots.map(s => s.start_time))].sort()
  const userInitials = user?.name ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'PM'
  const sortedBookings = [...activeBookings].sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
  const doneCount = Object.values(done).filter(Boolean).length

  // child pill styles
  const childBtn = (key) => ({
    fontSize: 'clamp(11px,1.3vw,14px)', fontWeight: 600,
    padding: 'clamp(6px,.9vw,10px) clamp(10px,1.4vw,16px)',
    borderRadius: 50, border: `2px solid ${activeChild === key ? (key === 'p' ? '#F47920' : '#93C5FD') : '#F4C099'}`,
    background: activeChild === key ? (key === 'p' ? '#FFF0E6' : '#EFF6FF') : '#fff',
    color: activeChild === key ? (key === 'p' ? '#C45A0A' : '#1D4ED8') : '#C4B5A5',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, transition: 'all .15s', whiteSpace: 'nowrap',
  })
  const checkCircle = (key) => ({
    width: 14, height: 14, borderRadius: '50%',
    background: activeChild === key ? (key === 'p' ? '#F47920' : '#2563EB') : '#D1D5DB',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  })

  if (loading) return (
    <div style={{ minHeight: '100svh', background: '#FFF8F3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif', color: '#F47920', fontWeight: 600 }}>Loading…</div>
  )

  return (
    <div style={{ background: '#FFF8F3', minHeight: '100svh', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif", WebkitFontSmoothing: 'antialiased' }}>
      <div style={S.screen}>

        {/* TOPBAR */}
        <div style={S.topbar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px,1.5vw,16px)' }}>
            <div style={S.avatar}>{userInitials}</div>
            <div>
              <div style={S.topbarName}>{user?.name || 'Paras Mehta'}</div>
              <div style={S.topbarSub}>Inventure Academy · PTM 09 Apr 2026</div>
            </div>
          </div>
          <button onClick={logoutUser} style={S.logoutBtn}>Sign out</button>
        </div>

        {/* MAIN TABS */}
        <div style={S.mainTabs}>
          <div onClick={() => setTab('book')} style={S.mainTab(tab === 'book')}>Book</div>
          <div onClick={() => setTab('sched')} style={S.mainTab(tab === 'sched')}>
            My schedule{activeBookings.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#F47920', color: '#fff', borderRadius: 20, fontSize: 'clamp(9px,1vw,12px)', fontWeight: 700, padding: '1px clamp(5px,.7vw,8px)', marginLeft: 5, verticalAlign: 'middle', minWidth: 20 }}>{activeBookings.length}</span>}
          </div>
        </div>

        {/* BOOK TAB */}
        {tab === 'book' && <>
          {/* Child selector */}
          <div style={S.childBar}>
            <span style={S.childLabel}>Tap to select:</span>
            {[['p', 'Parshv (Gr 7)'], ['d', 'Dhriti (Gr 4)']].map(([key, label]) => (
              <button key={key} onClick={() => setActiveChild(key)} style={childBtn(key)}>
                <span style={checkCircle(key)}>{activeChild === key && TICK}</span>
                {label}
              </button>
            ))}
            <button onClick={openAutoModal} style={S.autoBtn}>Auto-schedule</button>
          </div>

          {/* GRID */}
          <div style={S.gridWrap}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: 'clamp(48px,6vw,64px)', textAlign: 'left', borderBottom: '2px solid #F47920', background: '#FFF8F3', position: 'sticky', top: 0, zIndex: 5, paddingBottom: 8, paddingLeft: 'clamp(10px,1.5vw,18px)', fontSize: 'clamp(10px,1.2vw,13px)', fontWeight: 600, color: '#9CA3AF' }}>Time</th>
                  {teachers.map(t => (
                    <th key={t} style={{ textAlign: 'center', borderBottom: '2px solid #F47920', background: '#FFF8F3', minWidth: 'clamp(80px,9vw,110px)', position: 'sticky', top: 0, zIndex: 5, padding: '0 4px 8px', overflow: 'visible' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 5, height: '100%', padding: '8px 4px' }}>
                        <span style={{ fontSize: 'clamp(11px,1.3vw,14px)', fontWeight: 700, color: '#1B3F7A', textAlign: 'center', wordBreak: 'break-word', lineHeight: 1.2, width: '100%' }}>{t.split(' ')[0]}</span>
                        <span style={{ fontSize: 'clamp(9px,1vw,12px)', color: '#9CA3AF', textAlign: 'center', lineHeight: 1.1 }}>{t.split(' ').slice(1).join(' ')}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allTimes.map(time => (
                  <tr key={time}>
                    <td style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: '#9CA3AF', paddingLeft: 'clamp(10px,1.5vw,18px)', background: '#FFF8F3', fontWeight: 600, borderRight: '2px solid #F4C099', border: '1px solid #F0E4D4', height: 'clamp(32px,4vw,44px)', verticalAlign: 'middle' }}>{fmt(time)}</td>
                    {teachers.map(t => {
                      const slot = teacherGroups[t]?.find(s => s.start_time === time)
                      if (!slot) return <td key={t} style={{ border: '1px solid #F0E4D4', height: 'clamp(32px,4vw,44px)', background: '#F9FAFB' }} />
                      const isBooked = bookedSlotIds.has(slot.id)
                      const isFull = slot.booked_count >= slot.capacity && !isBooked
                      const hov = hoveredCancel === slot.id
                      const isP = activeChild === 'p'
                      return (
                        <td key={t} style={{ padding: 2, border: '1px solid #F0E4D4', height: 'clamp(32px,4vw,44px)', verticalAlign: 'middle' }}>
                          <button
                            onClick={() => { if (isBooked) { setCancelModal({ booking_id: slotToBookingId[slot.id], teacher: t }); return }; if (!isFull) handleBook(slot.id) }}
                            onMouseEnter={() => isBooked && setHoveredCancel(slot.id)}
                            onMouseLeave={() => setHoveredCancel(null)}
                            style={{
                              width: '100%', height: '100%', borderRadius: 8,
                              border: isBooked ? `1.5px solid ${isP ? '#F47920' : '#93C5FD'}` : 'none',
                              cursor: isFull && !isBooked ? 'default' : 'pointer',
                              background: hov && isBooked ? '#FEE2E2' : isBooked ? (isP ? '#FFF0E6' : '#EFF6FF') : isFull ? '#F5F0EC' : 'transparent',
                              color: hov && isBooked ? '#DC2626' : isBooked ? (isP ? '#C45A0A' : '#1D4ED8') : isFull ? '#C4B5A5' : '#F4C099',
                              fontSize: 'clamp(11px,1.3vw,14px)', fontWeight: isBooked ? 700 : 300, transition: 'all .1s', fontFamily: 'inherit',
                            }}>
                            {isBooked ? (hov ? '×' : '✓') : isFull ? '—' : '+'}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* LEGEND */}
          <div style={S.legend}>
            <span style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: '#9CA3AF', fontWeight: 600, marginRight: 4 }}>Legend:</span>
            {[{ label: 'Parshv', bg: '#FFF0E6', border: '#F47920' }, { label: 'Dhriti', bg: '#EFF6FF', border: '#93C5FD' }, { label: 'Taken', bg: '#F5F0EC', border: '#E5D5C5' }].map(l => (
              <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'clamp(11px,1.3vw,14px)', color: '#6B7280', fontWeight: 500 }}>
                <span style={{ width: 'clamp(14px,1.8vw,20px)', height: 'clamp(14px,1.8vw,20px)', borderRadius: 5, background: l.bg, border: `2px solid ${l.border}`, flexShrink: 0, display: 'inline-block' }} />
                {l.label}
              </span>
            ))}
          </div>

          {/* BOTTOM BAR */}
          <div style={S.bar}>
            <div>
              <div style={{ fontSize: 'clamp(13px,1.6vw,17px)', fontWeight: 700, color: '#1B3F7A' }}>{activeBookings.length} of {teachers.length} teachers booked</div>
              <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: '#9CA3AF', marginTop: 1 }}>{teachers.length - activeBookings.length} remaining</div>
            </div>
            <button style={S.cfmBtn(activeBookings.length > 0)} disabled={activeBookings.length === 0} onClick={() => showToast('Bookings confirmed!')}>Confirm bookings</button>
          </div>
        </>}

        {/* MY SCHEDULE TAB */}
        {tab === 'sched' && <>
          <div style={{ padding: 'clamp(10px,1.5vw,16px) clamp(16px,2.5vw,28px)', borderBottom: '1px solid #F4C099', background: '#FFF8F3', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#9CA3AF', fontWeight: 500 }}>{activeBookings.length} upcoming meetings</span>
          </div>
          <div style={S.schedScroll}>
            {activeBookings.length === 0 ? (
              <div style={{ padding: 'clamp(32px,5vw,60px)', textAlign: 'center', color: '#C4B5A5', fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 500 }}>No bookings yet</div>
            ) : sortedBookings.map((bk, i) => (
              <div key={bk.id} style={S.meetingItem(done[bk.id], false)}>
                <div style={S.timeCol}>
                  <div style={{ fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 700, color: done[bk.id] ? '#C4B5A5' : '#1B3F7A', letterSpacing: '-.02em' }}>{fmt(bk.start_time)}</div>
                </div>
                <div style={S.colorBar(!done[bk.id])} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px,1.4vw,14px)', flex: 1, padding: 'clamp(10px,1.4vw,14px) clamp(14px,2vw,18px)', minWidth: 0 }}>
                  <div style={{ ...S.avatarCircle, opacity: done[bk.id] ? .4 : 1 }}>{initials(bk.teacher_name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 700, color: done[bk.id] ? '#C4B5A5' : '#1B3F7A', letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: done[bk.id] ? 'line-through' : 'none' }}>{bk.teacher_name}</div>
                    <div style={{ fontSize: 'clamp(11px,1.3vw,15px)', color: '#9CA3AF', marginTop: 2 }}>{fmt(bk.start_time)} – {fmt(bk.end_time)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px,1.5vw,16px)', paddingRight: 'clamp(14px,2vw,22px)', flexShrink: 0 }}>
                  <div onClick={() => setDone(p => ({ ...p, [bk.id]: !p[bk.id] }))} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ width: 'clamp(22px,2.8vw,30px)', height: 'clamp(22px,2.8vw,30px)', borderRadius: 6, border: `2px solid ${done[bk.id] ? '#F47920' : '#F4C099'}`, background: done[bk.id] ? '#FFF0E6' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', flexShrink: 0 }}>
                      {done[bk.id] ? DONE_TICK : FAINT_TICK}
                    </div>
                  </div>
                  <button onClick={() => setCancelModal({ booking_id: bk.id, teacher: bk.teacher_name })} onMouseEnter={e => e.currentTarget.style.color = '#F47920'} onMouseLeave={e => e.currentTarget.style.color = '#C4B5A5'} style={S.xBtn}>×</button>
                </div>
              </div>
            ))}
          </div>
          <div style={S.bar}>
            <span style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#C45A0A', fontWeight: 600 }}>{doneCount} done</span>
            <button style={{ ...S.cfmBtn(true), background: '#1B3F7A', boxShadow: '0 2px 10px rgba(27,63,122,.25)' }} onClick={() => showToast('Opening calendar...')}>Export to calendar</button>
          </div>
        </>}
      </div>

      {/* CANCEL MODAL */}
      {cancelModal && (
        <div onClick={() => setCancelModal(null)} style={S.modalOverlay}>
          <div onClick={e => e.stopPropagation()} style={S.modalBox}>
            <div style={{ fontSize: 'clamp(17px,2.2vw,24px)', fontWeight: 700, color: '#1B3F7A', marginBottom: 8 }}>Cancel this meeting?</div>
            <div style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#9CA3AF', marginBottom: 'clamp(20px,3vw,30px)', lineHeight: 1.5 }}>Cancel your meeting with {cancelModal.teacher}?</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setCancelModal(null)} style={{ flex: 1, padding: 'clamp(12px,1.6vw,16px)', borderRadius: 12, fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 700, cursor: 'pointer', border: '2px solid #F4C099', background: '#fff', color: '#9CA3AF', fontFamily: 'inherit' }}>Back</button>
              <button onClick={handleCancel} style={{ flex: 1, padding: 'clamp(12px,1.6vw,16px)', borderRadius: 12, fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 700, cursor: 'pointer', border: 'none', background: '#F47920', color: '#fff', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* AUTO-SCHEDULE MODAL */}
      {autoModal && (
        <div style={S.modalOverlay}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 'min(400px,calc(100vw - 32px))', boxShadow: '0 12px 40px rgba(0,0,0,.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
            {autoResult === null ? (<>
              <div style={{ padding: 'clamp(18px,2.5vw,28px) clamp(20px,2.8vw,28px) clamp(12px,1.8vw,18px)', borderBottom: '1px solid #F4C099' }}>
                <div style={{ fontSize: 'clamp(16px,2vw,22px)', fontWeight: 800, color: '#1B3F7A' }}>✦ Auto-schedule</div>
                <div style={{ fontSize: 'clamp(12px,1.5vw,15px)', color: '#9CA3AF', marginTop: 4 }}>Pick teachers — we'll find a conflict-free schedule</div>
              </div>
              <div style={{ padding: 'clamp(8px,1.2vw,12px) clamp(20px,2.8vw,28px)', borderBottom: '1px solid #F4C099', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: '#9CA3AF' }}>{selectedTeachers.size} of {teacherOptions.length} selected</span>
                <button onClick={() => setSelectedTeachers(selectedTeachers.size === teacherOptions.length ? new Set() : new Set(teacherOptions.map(t => t.id)))} style={{ fontSize: 'clamp(11px,1.3vw,14px)', fontWeight: 700, color: '#F47920', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{selectedTeachers.size === teacherOptions.length ? 'Deselect all' : 'Select all'}</button>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {teacherOptions.map((t, i) => {
                  const checked = selectedTeachers.has(t.id)
                  return (
                    <div key={t.id} onClick={() => toggleTeacher(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'clamp(10px,1.4vw,14px) clamp(20px,2.8vw,28px)', cursor: 'pointer', borderBottom: i < teacherOptions.length - 1 ? '1px solid #FDE9D4' : 'none', background: checked ? '#FFF8F3' : '#fff', transition: 'background .1s' }}>
                      <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: checked ? '2px solid #F47920' : '1.5px solid #F4C099', background: checked ? '#F47920' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .1s' }}>
                        {checked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 600, color: '#1B3F7A' }}>{t.name}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ padding: 'clamp(14px,2vw,20px) clamp(20px,2.8vw,28px)', borderTop: '1px solid #FDE9D4', display: 'flex', gap: 10 }}>
                <button onClick={() => setAutoModal(false)} style={{ flex: 1, padding: 'clamp(10px,1.4vw,14px)', fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 700, background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={handleAutoSchedule} disabled={selectedTeachers.size === 0 || autoScheduling} style={{ flex: 2, padding: 'clamp(10px,1.4vw,14px)', fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 700, background: selectedTeachers.size === 0 || autoScheduling ? '#F4C099' : '#F47920', color: '#fff', border: 'none', borderRadius: 9, cursor: selectedTeachers.size === 0 || autoScheduling ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                  {autoScheduling ? 'Scheduling…' : `Schedule ${selectedTeachers.size > 0 ? selectedTeachers.size : ''} meeting${selectedTeachers.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </>) : (<>
              <div style={{ padding: 'clamp(24px,3vw,32px) clamp(20px,2.8vw,28px) clamp(16px,2vw,22px)', textAlign: 'center', borderBottom: '1px solid #FDE9D4' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', margin: '0 auto 10px', background: autoResult.booked.length > 0 ? '#FFF0E6' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: autoResult.booked.length > 0 ? '#C45A0A' : '#9CA3AF' }}>{autoResult.booked.length > 0 ? '✓' : '—'}</div>
                <div style={{ fontSize: 'clamp(16px,2vw,22px)', fontWeight: 800, color: '#1B3F7A' }}>{autoResult.booked.length > 0 ? `Scheduled ${autoResult.booked.length} meeting${autoResult.booked.length !== 1 ? 's' : ''}` : 'No slots available'}</div>
                {autoResult.conflicts.length > 0 && <div style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: '#9CA3AF', marginTop: 4 }}>{autoResult.conflicts.length} teacher{autoResult.conflicts.length !== 1 ? 's' : ''} couldn't be scheduled</div>}
              </div>
              <div style={{ overflowY: 'auto', flex: 1, padding: 'clamp(12px,1.8vw,18px) clamp(20px,2.8vw,28px)' }}>
                {autoResult.booked.map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < autoResult.booked.length - 1 ? '1px solid #FDE9D4' : 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F47920', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 700, color: '#1B3F7A' }}>{b.teacher_name}</div>
                      <div style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: '#9CA3AF', marginTop: 1 }}>{fmt(b.start_time)} – {fmt(b.end_time)}</div>
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
              <div style={{ padding: 'clamp(14px,2vw,20px) clamp(20px,2.8vw,28px)', borderTop: '1px solid #FDE9D4' }}>
                <button onClick={() => setAutoModal(false)} style={{ width: '100%', padding: 'clamp(12px,1.6vw,16px)', fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 700, background: '#F47920', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit' }}>Done</button>
              </div>
            </>)}
          </div>
        </div>
      )}

      {/* TOAST */}
      <div style={S.toast(!!toast)}>{toast}</div>
    </div>
  )
}
