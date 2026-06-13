import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSlots } from '../api/slots'
import { createBooking, getMyBookings, cancelBooking, autoSchedule } from '../api/bookings'
import { LOGO_LARGE } from '../assets/logos'
import { titleName } from '../utils/teacherTitle'

const PARSHV_TEACHERS = ['Sandhya Chhetri','Helen Gilbert','Priya Naidu','Susan Christi','Anwesha Basu','Anthony Samuel','Sunaina Naugain','Shubha S','Muneezah Mattu']
const DHRITI_TEACHERS = ['Kavya Sharma','Rina Patel','Deepa Nair','Preethi Rao','Anjali Menon','Swati Joshi']

const CHILD_SUBJECTS = {
  'Sandhya Chhetri':'Chemistry','Helen Gilbert':'Computers','Priya Naidu':'History/Civics',
  'Susan Christi':'English','Anwesha Basu':'Physics','Anthony Samuel':'Biology',
  'Sunaina Naugain':'French','Shubha S':'Mathematics','Muneezah Mattu':'Theme/EVS',
  'Kavya Sharma':'Theme/EVS','Rina Patel':'Mathematics','Deepa Nair':'French',
  'Preethi Rao':'English','Anjali Menon':'Kannada','Swati Joshi':'Computers',
}

const fmt = iso => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
const initials = name => { if (!name) return '??'; const p = name.replace(/^(Ms\.|Mr\.|Dr\.)/,'').trim().split(' ').filter(Boolean); return p.length >= 2 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : p[0].slice(0,2).toUpperCase() }

const TICK = <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><polyline points="2,5 4,7.5 8,2.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
const DONE_TICK = <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#F47920" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>

function Toast({ msg }) {
  return <div style={{ position: 'fixed', bottom: 'clamp(16px,2.5vw,28px)', left: '50%', transform: 'translateX(-50%)', background: '#1B3F7A', color: '#fff', padding: 'clamp(10px,1.4vw,16px) clamp(18px,2.5vw,28px)', borderRadius: 50, fontSize: 'clamp(13px,1.6vw,17px)', fontWeight: 600, opacity: msg ? 1 : 0, transition: 'opacity .3s', pointerEvents: 'none', zIndex: 999, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(27,63,122,.3)', maxWidth: 'calc(100vw - 32px)', textAlign: 'center' }}>{msg}</div>
}

export default function ParentDashboard() {
  const { user, logoutUser } = useAuth()
  const [slots, setSlots] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [tab, setTab] = useState('grid')
  const [done, setDone] = useState({})
  const [hoveredCancel, setHoveredCancel] = useState(null)
  const [cancelModal, setCancelModal] = useState(null)
  const [autoModal, setAutoModal] = useState(false)
  const [autoScheduling, setAutoScheduling] = useState(false)
  const [autoResult, setAutoResult] = useState(null)
  const [selectedTeachers, setSelectedTeachers] = useState(new Set())
  const [welcomeModal, setWelcomeModal] = useState(false)
  const [welcomeChecked, setWelcomeChecked] = useState(false)

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
    try {
      const [s, b] = await Promise.all([getSlots(), getMyBookings()])
      setSlots(s); setBookings(b)
      if (!welcomeChecked) {
        if (b.filter(x => x.status !== 'cancelled').length === 0) setWelcomeModal(true)
        setWelcomeChecked(true)
      }
    } catch { showToast('Failed to load data') }
    setLoading(false)
  }

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const bookedSlotIds = new Set(bookings.filter(b => b.status !== 'cancelled').map(b => b.slot_id))
  const slotToBookingId = Object.fromEntries(bookings.filter(b => b.status !== 'cancelled').map(b => [b.slot_id, b.id]))
  const activeBookings = bookings.filter(b => b.status !== 'cancelled')
  const bookedTimes = new Set(activeBookings.map(b => b.start_time))
  const bookedTeacherNames = new Set(activeBookings.map(b => b.teacher_name))

  const groupByTeacher = (teacherList) => {
    const map = {}
    slots.filter(s => teacherList.some(t => s.teacher_name?.includes(t))).forEach(s => {
      if (!map[s.teacher_name]) map[s.teacher_name] = []
      map[s.teacher_name].push(s)
    })
    return map
  }

  // The logged-in account IS the student; pick teacher list by grade.
  const activeChild = user?.grade === 4 ? 'd' : 'p'
  const currentTeachers = activeChild === 'p' ? PARSHV_TEACHERS : DHRITI_TEACHERS
  const teacherGroups = groupByTeacher(currentTeachers)
  const teachers = Object.keys(teacherGroups)
  const allTimes = [...new Set(Object.values(teacherGroups).flat().map(s => s.start_time))].sort()

  const teacherOptions = [...new Map(slots.map(s => [s.teacher_id, s.teacher_name])).entries()].map(([id, name]) => ({ id, name })).filter(t => currentTeachers.some(ct => t.name?.includes(ct)))

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
    try { const result = await autoSchedule([...selectedTeachers]); setAutoResult(result); await fetchData() }
    catch (err) { showToast(err.response?.data?.detail || 'Auto-schedule failed') }
    setAutoScheduling(false)
  }

  const userInitials = user?.name ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'PM'
  const doneCount = Object.values(done).filter(Boolean).length
  const bookedCount = activeBookings.length

  // Slot color for current child
  const slotClass = (slot) => {
    const isBooked = bookedSlotIds.has(slot.id)
    const isFull = slot.booked_count >= slot.capacity && !isBooked
    const isTimeConflict = !isBooked && bookedTimes.has(slot.start_time)
    const isTeacherBooked = !isBooked && bookedTeacherNames.has(slot.teacher_name)
    if (isFull || isTimeConflict || isTeacherBooked) return 'taken'
    if (isBooked) return activeChild === 'p' ? 'child1' : 'child2'
    return 'free'
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#FFF8F3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F47920', fontWeight: 600, fontFamily: 'system-ui,sans-serif' }}>Loading…</div>

  return (
    <div style={{ background: '#FFF8F3', minHeight: '100vh', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif", WebkitFontSmoothing: 'antialiased' }}>
      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', width: 'min(96vw,960px)', margin: 'clamp(10px,2vw,20px) auto', boxShadow: '0 2px 20px rgba(0,0,0,.06)', display: 'flex', flexDirection: 'column', height: 'calc(100svh - clamp(20px,4vw,40px))' }}>

        {/* TOPBAR */}
        <div style={{ padding: 'clamp(12px,1.8vw,20px) clamp(16px,2.5vw,28px)', background: '#F47920', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px,1.5vw,16px)' }}>
            <div style={{ width: 'clamp(36px,4.5vw,48px)', height: 'clamp(36px,4.5vw,48px)', borderRadius: '50%', background: 'rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(13px,1.6vw,17px)', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{userInitials}</div>
            <div>
              <div style={{ fontSize: 'clamp(15px,2vw,22px)', fontWeight: 700, color: '#fff', letterSpacing: '-.03em' }}>{user?.name || 'Student'}{user?.section ? ` · ${user.section}` : ''}</div>
              {user?.parent_name && <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: 'rgba(255,255,255,.8)', marginTop: 2 }}>Parent: {user.parent_name}</div>}
              <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: 'rgba(255,255,255,.65)', marginTop: 2 }}>Inventure Academy · PTM 09 Apr 2026</div>
            </div>
          </div>
          <img src={LOGO_LARGE} alt="Inventure" style={{ height: 'clamp(24px,3vw,36px)', width: 'auto', filter: 'brightness(0) invert(1)', opacity: .9 }} />
        </div>

        {/* MAIN TABS */}
        <div style={{ display: 'flex', background: '#fff', borderBottom: '2px solid #F4C099', flexShrink: 0 }}>
          {[['grid','Book'],['sched','My schedule'],['past','Past']].map(([key, lbl]) => (
            <div key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: 'clamp(12px,1.8vw,18px) 8px', textAlign: 'center', fontSize: 'clamp(13px,1.6vw,17px)', fontWeight: 600, cursor: 'pointer', color: tab === key ? '#F47920' : '#C4B5A5', borderBottom: `3px solid ${tab === key ? '#F47920' : 'transparent'}`, marginBottom: -2, transition: 'all .2s', letterSpacing: '-.01em' }}>
              {lbl}
              {key === 'sched' && activeBookings.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#F47920', color: '#fff', borderRadius: 20, fontSize: 'clamp(9px,1vw,12px)', fontWeight: 700, padding: '1px clamp(5px,.7vw,8px)', marginLeft: 5, verticalAlign: 'middle', minWidth: 20 }}>{activeBookings.length}</span>}
            </div>
          ))}
        </div>

        {/* BOOK TAB */}
        {tab === 'grid' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Action bar */}
            <div className="custom-scroll" style={{ padding: 'clamp(10px,1.4vw,16px) clamp(16px,2.5vw,28px)', background: '#FFF8F3', borderBottom: '1px solid #F4C099', display: 'flex', alignItems: 'center', gap: 'clamp(8px,1.2vw,14px)', flexWrap: 'nowrap', overflowX: 'auto', flexShrink: 0 }}>
              <span style={{ fontSize: 'clamp(11px,1.3vw,15px)', color: '#9CA3AF', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>Tap a teacher slot to book a meeting</span>
              <button onClick={openAutoModal} style={{ fontSize: 'clamp(11px,1.3vw,15px)', fontWeight: 700, padding: 'clamp(7px,1vw,12px) clamp(12px,1.6vw,20px)', borderRadius: 50, background: '#1B3F7A', color: '#fff', border: 'none', cursor: 'pointer', marginLeft: 'auto', whiteSpace: 'nowrap', boxShadow: '0 2px 12px rgba(27,63,122,.3)', fontFamily: 'inherit', flexShrink: 0 }}>Auto-schedule</button>
            </div>

            {/* Grid */}
            <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: 'clamp(48px,6vw,64px)', textAlign: 'left', borderBottom: '2px solid #F47920', background: '#FFF8F3', verticalAlign: 'bottom', paddingBottom: 8, paddingLeft: 'clamp(10px,1.5vw,18px)', fontSize: 'clamp(10px,1.2vw,13px)', fontWeight: 600, color: '#9CA3AF', position: 'sticky', top: 0, zIndex: 5 }}>Time</th>
                    {teachers.map(t => (
                      <th key={t} style={{ textAlign: 'center', borderBottom: '2px solid #F47920', background: '#FFF8F3', verticalAlign: 'bottom', minWidth: 'clamp(80px,9vw,110px)', position: 'sticky', top: 0, zIndex: 5, padding: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 5, height: '100%', padding: '8px 4px' }}>
                          <span style={{ fontSize: 'clamp(11px,1.3vw,14px)', fontWeight: 700, color: '#1B3F7A', textAlign: 'center', wordBreak: 'break-word', lineHeight: 1.2, width: '100%' }}>{titleName(t).split(' ').slice(0, 2).join(' ')}</span>
                          <span style={{ fontSize: 'clamp(9px,1vw,12px)', color: '#9CA3AF', textAlign: 'center', lineHeight: 1.1 }}>{CHILD_SUBJECTS[t.replace(/^(Ms\.|Mr\.|Dr\.)/,'').trim()] || ''}</span>
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
                        const cls = slotClass(slot)
                        const hov = hoveredCancel === slot.id
                        const isBooked = cls === 'child1' || cls === 'child2'
                        if (cls === 'taken') return (
                          <td key={t} style={{ padding: 2, border: '1px solid #F0E4D4', height: 'clamp(32px,4vw,44px)', verticalAlign: 'middle' }}>
                            <div style={{ width: '100%', height: '100%', borderRadius: 8, background: '#F5F0EC', cursor: 'default' }} />
                          </td>
                        )
                        return (
                          <td key={t} style={{ padding: 2, border: '1px solid #F0E4D4', height: 'clamp(32px,4vw,44px)', verticalAlign: 'middle' }}>
                            <button
                              onClick={() => { if (isBooked) { setCancelModal({ booking_id: slotToBookingId[slot.id], teacher: t }); return }; handleBook(slot.id) }}
                              onMouseEnter={() => isBooked && setHoveredCancel(slot.id)}
                              onMouseLeave={() => setHoveredCancel(null)}
                              style={{
                                width: '100%', height: '100%', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: cls === 'child1' ? '2px solid #F47920' : cls === 'child2' ? '2px solid #93C5FD' : 'none',
                                cursor: 'pointer',
                                background: hov && isBooked ? '#FEE2E2' : cls === 'child1' ? '#FFF0E6' : cls === 'child2' ? '#EFF6FF' : 'transparent',
                                color: hov && isBooked ? '#DC2626' : cls === 'child1' ? '#C45A0A' : cls === 'child2' ? '#1D4ED8' : '#E5D5C5',
                                fontSize: cls === 'free' ? 'clamp(16px,2vw,22px)' : 'clamp(11px,1.3vw,14px)',
                                fontWeight: cls === 'free' ? 300 : 600,
                                transition: 'all .12s', fontFamily: 'inherit',
                              }}>
                              {isBooked ? (hov ? '×' : '✓') : '+'}
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
            <div style={{ display: 'flex', gap: 'clamp(10px,1.5vw,18px)', padding: 'clamp(10px,1.4vw,14px) clamp(16px,2.5vw,28px)', borderTop: '1px solid #F4C099', background: '#FFF8F3', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: '#9CA3AF', fontWeight: 600, marginRight: 4 }}>Legend:</span>
              {[{ label: user?.name?.split(' ')[0] || 'Booked', bg: activeChild === 'p' ? '#FFF0E6' : '#EFF6FF', border: activeChild === 'p' ? '#F47920' : '#93C5FD' }, { label: 'Taken', bg: '#F5F0EC', border: '#E5D5C5' }].map(l => (
                <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'clamp(11px,1.3vw,14px)', color: '#6B7280', fontWeight: 500 }}>
                  <span style={{ width: 'clamp(14px,1.8vw,20px)', height: 'clamp(14px,1.8vw,20px)', borderRadius: 5, background: l.bg, border: `2px solid ${l.border}`, flexShrink: 0, display: 'inline-block' }} />{l.label}
                </span>
              ))}
            </div>

            {/* Bottom bar */}
            <div style={{ padding: 'clamp(12px,1.8vw,18px) clamp(16px,2.5vw,28px)', borderTop: '1px solid #F4C099', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF8F3', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#C45A0A', fontWeight: 600 }}>{bookedCount > 0 ? `${bookedCount} teacher${bookedCount !== 1 ? 's' : ''} booked` : 'Tap a slot to book'}</span>
            </div>
          </div>
        )}

        {/* MY SCHEDULE TAB */}
        {tab === 'sched' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ padding: 'clamp(10px,1.5vw,16px) clamp(16px,2.5vw,28px)', borderBottom: '1px solid #F4C099', background: '#FFF8F3', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#9CA3AF', fontWeight: 500 }}>{activeBookings.length} upcoming meetings</span>
            </div>
            <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {activeBookings.length === 0 ? (
                <div style={{ padding: 'clamp(32px,5vw,60px)', textAlign: 'center', color: '#C4B5A5', fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 500 }}>
                  <div style={{ fontSize: 'clamp(36px,5vw,56px)', marginBottom: 10, opacity: .5 }}>📅</div>
                  No bookings yet
                </div>
              ) : [...activeBookings].sort((a,b) => new Date(a.start_time) - new Date(b.start_time)).map(bk => {
                const isDone = done[bk.id]
                const barColor = isDone ? '#E5E5E5' : '#F4C099'
                return (
                  <div key={bk.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #F4EDE4', minHeight: 'clamp(62px,8vw,80px)', background: isDone ? '#FAFAFA' : '#fff', transition: 'background .12s' }}>
                    <div style={{ width: 'clamp(60px,8vw,80px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px', flexShrink: 0 }}>
                      <div style={{ fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 700, color: isDone ? '#C4B5A5' : '#1B3F7A', letterSpacing: '-.02em' }}>{fmt(bk.start_time)}</div>
                    </div>
                    <div style={{ width: 3, flexShrink: 0, alignSelf: 'stretch', background: barColor }} />
                    <div style={{ flex: 1, minWidth: 0, padding: 'clamp(8px,1.2vw,12px) clamp(14px,2vw,18px)' }}>
                      <div style={{ fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 700, color: isDone ? '#C4B5A5' : '#1B3F7A', letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: isDone ? 'line-through' : 'none' }}>{titleName(bk.teacher_name)}</div>
                      <div style={{ fontSize: 'clamp(11px,1.3vw,15px)', color: '#9CA3AF', marginTop: 2 }}>{fmt(bk.start_time)} – {fmt(bk.end_time)}{bk.teacher_venue ? <span style={{ marginLeft: 8 }}>· {bk.teacher_venue}</span> : null}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px,1.5vw,16px)', paddingRight: 'clamp(14px,2vw,22px)', flexShrink: 0 }}>
                      <div onClick={() => setDone(p => ({ ...p, [bk.id]: !p[bk.id] }))} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
                        <div style={{ width: 'clamp(22px,2.8vw,30px)', height: 'clamp(22px,2.8vw,30px)', borderRadius: 6, border: `2px solid ${isDone ? '#F47920' : '#F4C099'}`, background: isDone ? '#FFF0E6' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', flexShrink: 0 }}>
                          {isDone && DONE_TICK}
                        </div>
                      </div>
                      <button onClick={() => setCancelModal({ booking_id: bk.id, teacher: bk.teacher_name })}
                        onMouseEnter={e => e.currentTarget.style.color = '#F47920'}
                        onMouseLeave={e => e.currentTarget.style.color = '#C4B5A5'}
                        style={{ width: 'clamp(28px,3.5vw,38px)', height: 'clamp(28px,3.5vw,38px)', borderRadius: 8, background: '#fff', border: 'none', color: '#C4B5A5', cursor: 'pointer', fontSize: 'clamp(18px,2.2vw,26px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 300, lineHeight: 1, padding: 0, transition: 'color .12s' }}>×</button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ padding: 'clamp(12px,1.8vw,18px) clamp(16px,2.5vw,28px)', borderTop: '1px solid #F4C099', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF8F3', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#C45A0A', fontWeight: 600 }}>{doneCount} done</span>
              <button onClick={() => {}} title="Coming soon" style={{ fontSize: 'clamp(13px,1.8vw,18px)', fontWeight: 700, padding: 'clamp(10px,1.4vw,16px) clamp(16px,3vw,36px)', borderRadius: 50, background: '#1B3F7A', color: '#fff', border: 'none', cursor: 'not-allowed', opacity: .45, boxShadow: '0 2px 10px rgba(27,63,122,.25)', fontFamily: 'inherit' }}>Export to calendar</button>
            </div>
          </div>
        )}

        {/* PAST TAB */}
        {tab === 'past' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ padding: 'clamp(10px,1.5vw,16px) clamp(16px,2.5vw,28px)', borderBottom: '1px solid #F4C099', background: '#FFF8F3', flexShrink: 0 }}>
              <span style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#9CA3AF', fontWeight: 500 }}>Past meetings</span>
            </div>
            <div style={{ padding: 'clamp(32px,5vw,60px)', textAlign: 'center', color: '#C4B5A5', fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 500 }}>No past meetings yet</div>
          </div>
        )}
      </div>

      {/* CANCEL MODAL */}
      {cancelModal && (
        <div onClick={() => setCancelModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20, backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 'clamp(24px,3.5vw,40px)', width: '100%', maxWidth: 'min(380px,calc(100vw - 32px))', textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,.15)' }}>
            <div style={{ fontSize: 'clamp(17px,2.2vw,24px)', fontWeight: 700, color: '#1B3F7A', marginBottom: 8, letterSpacing: '-.02em' }}>Cancel this meeting?</div>
            <div style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#9CA3AF', marginBottom: 'clamp(20px,3vw,30px)', lineHeight: 1.5 }}>Cancel your meeting with {titleName(cancelModal.teacher)}?</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setCancelModal(null)} style={{ flex: 1, padding: 'clamp(12px,1.6vw,16px)', borderRadius: 12, fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 700, cursor: 'pointer', border: '2px solid #F4C099', background: '#fff', color: '#9CA3AF', fontFamily: 'inherit' }}>Keep it</button>
              <button onClick={handleCancel} style={{ flex: 1, padding: 'clamp(12px,1.6vw,16px)', borderRadius: 12, fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1B3F7A', color: '#fff', fontFamily: 'inherit' }}>Cancel meeting</button>
            </div>
          </div>
        </div>
      )}

      {/* AUTO MODAL */}
      {autoModal && (
        <div onClick={() => setAutoModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20, backdropFilter: 'blur(2px)' }}>
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
              <div className="custom-scroll" style={{ overflowY: 'auto', flex: 1 }}>
                {teacherOptions.map((t, i) => {
                  const checked = selectedTeachers.has(t.id)
                  const subject = CHILD_SUBJECTS[t.name?.replace(/^(Ms\.|Mr\.|Dr\.)\s*/,'').trim()] || ''
                  return (
                    <div key={t.id} onClick={() => toggleTeacher(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'clamp(10px,1.4vw,14px) clamp(20px,2.8vw,28px)', cursor: 'pointer', borderBottom: i < teacherOptions.length - 1 ? '1px solid #FDE9D4' : 'none', background: checked ? '#FFF8F3' : '#fff', transition: 'background .1s' }}>
                      <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: checked ? '2px solid #F47920' : '1.5px solid #F4C099', background: checked ? '#F47920' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .1s' }}>
                        {checked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>✓</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 600, color: '#1B3F7A' }}>{titleName(t.name)}</div>
                        {subject && <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: '#9CA3AF', marginTop: 1 }}>{subject}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ padding: 'clamp(14px,2vw,20px) clamp(20px,2.8vw,28px)', borderTop: '1px solid #FDE9D4', display: 'flex', gap: 10 }}>
                <button onClick={() => setAutoModal(false)} style={{ flex: 1, padding: 'clamp(10px,1.4vw,14px)', fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 700, background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={handleAutoSchedule} disabled={selectedTeachers.size === 0 || autoScheduling} style={{ flex: 2, padding: 'clamp(10px,1.4vw,14px)', fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 700, background: selectedTeachers.size === 0 || autoScheduling ? '#F4C099' : '#1B3F7A', color: '#fff', border: 'none', borderRadius: 9, cursor: selectedTeachers.size === 0 || autoScheduling ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                  {autoScheduling ? 'Scheduling…' : `Schedule ${selectedTeachers.size > 0 ? selectedTeachers.size : ''} meeting${selectedTeachers.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </>) : (<>
              <div style={{ padding: 'clamp(24px,3vw,32px) clamp(20px,2.8vw,28px) clamp(16px,2vw,22px)', textAlign: 'center', borderBottom: '1px solid #FDE9D4' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', margin: '0 auto 10px', background: autoResult.booked.length > 0 ? '#FFF0E6' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: autoResult.booked.length > 0 ? '#C45A0A' : '#9CA3AF' }}>{autoResult.booked.length > 0 ? '✓' : '—'}</div>
                <div style={{ fontSize: 'clamp(16px,2vw,22px)', fontWeight: 800, color: '#1B3F7A' }}>{autoResult.booked.length > 0 ? `Scheduled ${autoResult.booked.length} meeting${autoResult.booked.length !== 1 ? 's' : ''}` : 'No slots available'}</div>
                {autoResult.conflicts.length > 0 && <div style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: '#9CA3AF', marginTop: 4 }}>{autoResult.conflicts.length} teacher{autoResult.conflicts.length !== 1 ? 's' : ''} couldn't be scheduled</div>}
              </div>
              <div className="custom-scroll" style={{ overflowY: 'auto', flex: 1, padding: 'clamp(12px,1.8vw,18px) clamp(20px,2.8vw,28px)' }}>
                {autoResult.booked.map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < autoResult.booked.length - 1 ? '1px solid #FDE9D4' : 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F47920', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 700, color: '#1B3F7A' }}>{titleName(b.teacher_name)}</div>
                      <div style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: '#9CA3AF', marginTop: 1 }}>{fmt(b.start_time)} – {fmt(b.end_time)}</div>
                    </div>
                    <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', fontWeight: 700, color: '#C45A0A', background: '#FFF0E6', padding: '2px 8px', borderRadius: 20 }}>Confirmed</div>
                  </div>
                ))}
                {autoResult.conflicts.length > 0 && (
                  <div style={{ marginTop: autoResult.booked.length > 0 ? 14 : 0, background: '#F9FAFB', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 'clamp(9px,1.1vw,12px)', fontWeight: 700, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Could not schedule</div>
                    {autoResult.conflicts.map((name, i) => <div key={i} style={{ fontSize: 'clamp(12px,1.5vw,15px)', color: '#6B7280', padding: '4px 0', borderBottom: i < autoResult.conflicts.length - 1 ? '1px solid #E5E7EB' : 'none' }}>{name}</div>)}
                  </div>
                )}
              </div>
              <div style={{ padding: 'clamp(14px,2vw,20px) clamp(20px,2.8vw,28px)', borderTop: '1px solid #FDE9D4' }}>
                <button onClick={() => setAutoModal(false)} style={{ width: '100%', padding: 'clamp(12px,1.6vw,16px)', fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 700, background: '#1B3F7A', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit' }}>Done</button>
              </div>
            </>)}
          </div>
        </div>
      )}

      {/* WELCOME MODAL */}
      {welcomeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20, backdropFilter: 'blur(3px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 'clamp(28px,4vw,44px)', width: '100%', maxWidth: 'min(400px,calc(100vw - 32px))', textAlign: 'center', boxShadow: '0 16px 60px rgba(0,0,0,.18)' }}>
            <div style={{ fontSize: 'clamp(22px,3vw,32px)', marginBottom: 10 }}>👋</div>
            <div style={{ fontSize: 'clamp(18px,2.5vw,26px)', fontWeight: 800, color: '#1B3F7A', marginBottom: 10, letterSpacing: '-.02em' }}>Welcome!</div>
            <div style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#9CA3AF', marginBottom: 'clamp(24px,3.5vw,36px)', lineHeight: 1.6 }}>PTM is on 09 Apr 2026. Want us to auto-schedule all your meetings?</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => { setWelcomeModal(false) }} style={{ flex: 1, padding: 'clamp(12px,1.6vw,16px)', borderRadius: 12, fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 700, cursor: 'pointer', border: '2px solid #E5E7EB', background: '#F3F4F6', color: '#6B7280', fontFamily: 'inherit' }}>I'll choose myself</button>
              <button onClick={() => { setWelcomeModal(false); openAutoModal() }} style={{ flex: 1, padding: 'clamp(12px,1.6vw,16px)', borderRadius: 12, fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1B3F7A', color: '#fff', fontFamily: 'inherit', boxShadow: '0 2px 12px rgba(27,63,122,.3)' }}>Auto-Schedule</button>
            </div>
          </div>
        </div>
      )}

      <Toast msg={toast} />
    </div>
  )
}
