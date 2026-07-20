import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSlots } from '../api/slots'
import { batchBooking, getMyBookings, cancelBooking, autoSchedule } from '../api/bookings'
import { getMyNotes, saveNote as saveNoteApi } from '../api/notes'
import { LOGO_LARGE } from '../assets/logos'
import { titleName } from '../utils/teacherTitle'

const noteIcon = filled => (
  <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
    <rect x="4" y="2.5" width="12" height="15" rx="2" stroke={filled ? '#F47920' : '#C4B5A5'} strokeWidth="1.6" fill={filled ? '#FFF0E6' : 'none'} />
    <line x1="7" y1="6.5" x2="13" y2="6.5" stroke={filled ? '#F47920' : '#C4B5A5'} strokeWidth="1.4" strokeLinecap="round" />
    <line x1="7" y1="10" x2="13" y2="10" stroke={filled ? '#F47920' : '#C4B5A5'} strokeWidth="1.4" strokeLinecap="round" />
    <line x1="7" y1="13.5" x2="11" y2="13.5" stroke={filled ? '#F47920' : '#C4B5A5'} strokeWidth="1.4" strokeLinecap="round" />
  </svg>
)

const PARSHV_TEACHERS = ['Sandhya Chhetri','Helen Gilbert','Priya Naidu','Susan Christi','Anwesha Basu','Anthony Samuel','Sunaina Naugain','Shubha S','Muneezah Mattu']
const DHRITI_TEACHERS = ['Kavya Sharma','Rina Patel','Deepa Nair','Preethi Rao','Anjali Menon','Swati Joshi']

const CHILDREN = {
  p: { label: 'Parshv', student_name: 'Parshv Mehta', section: '7C', teachers: PARSHV_TEACHERS },
  d: { label: 'Dhriti', student_name: 'Dhriti Mehta', section: '4A', teachers: DHRITI_TEACHERS },
}

const CHILD_SUBJECTS = {
  'Sandhya Chhetri':'Chemistry','Helen Gilbert':'Computers','Priya Naidu':'History/Civics',
  'Susan Christi':'English','Anwesha Basu':'Physics','Anthony Samuel':'Biology',
  'Sunaina Naugain':'French','Shubha S':'Mathematics','Muneezah Mattu':'Theme/EVS',
  'Kavya Sharma':'Theme/EVS','Rina Patel':'Mathematics','Deepa Nair':'French',
  'Preethi Rao':'English','Anjali Menon':'Kannada','Swati Joshi':'Computers',
}

const childKey = bk => {
  const sec = bk?.section || ''
  if (sec.startsWith('7')) return 'p'
  if (sec.startsWith('4')) return 'd'
  return null
}
const CHILD_ACCENT = { p: '#F47920', d: '#2563EB' }
const CHILD_PILL = { p: { bg: '#FFF0E6', text: '#C45A0A' }, d: { bg: '#EFF6FF', text: '#1D4ED8' } }

const FAIL_REASON = {
  blocked: 'blocked by teacher',
  taken: 'just taken',
  conflict: 'time conflict',
  already_booked: 'already booked',
  not_found: 'slot not found',
}

const fmt = iso => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })

const DONE_TICK = <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#F47920" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>

function Toast({ msg }) {
  return <div style={{ position: 'fixed', bottom: 'clamp(16px,2.5vw,28px)', left: '50%', transform: 'translateX(-50%)', background: '#1B3F7A', color: '#fff', padding: 'clamp(10px,1.4vw,16px) clamp(18px,2.5vw,28px)', borderRadius: 50, fontSize: 'clamp(13px,1.6vw,17px)', fontWeight: 600, opacity: msg ? 1 : 0, transition: 'opacity .3s', pointerEvents: 'none', zIndex: 999, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(27,63,122,.3)', maxWidth: 'calc(100vw - 32px)', textAlign: 'center' }}>{msg}</div>
}

// Persist parent settings across refreshes. All access is try/catch-guarded so a
// blocked/unavailable localStorage falls back silently to in-memory defaults.
const SETTINGS_KEYS = { animations: 'ptm.settings.animations', sound: 'ptm.settings.sound' }
const readStoredBool = (key, fallback) => {
  try {
    const v = localStorage.getItem(key)
    if (v === 'true') return true
    if (v === 'false') return false
    return fallback
  } catch { return fallback }
}
const writeStoredBool = (key, val) => {
  try { localStorage.setItem(key, val ? 'true' : 'false') } catch { /* unavailable — ignore */ }
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
  const [activeChild, setActiveChild] = useState('p')
  const [colourByChild, setColourByChild] = useState(false)
  const [slotInfoModal, setSlotInfoModal] = useState(null)
  const [cart, setCart] = useState([])
  const [confirming, setConfirming] = useState(false)
  const [batchResult, setBatchResult] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [animationsOn, setAnimationsOn] = useState(() => readStoredBool(SETTINGS_KEYS.animations, true))   // default ON
  const [soundOn, setSoundOn] = useState(() => readStoredBool(SETTINGS_KEYS.sound, false))                 // default OFF (politer)
  const [cartAnimating, setCartAnimating] = useState(false)
  const [animatedInIds, setAnimatedInIds] = useState(() => new Set())
  const [confirmFlourish, setConfirmFlourish] = useState(false)
  const pendingPicksRef = useRef([])
  const audioCtxRef = useRef(null)
  const animTimersRef = useRef([])
  const [notes, setNotes] = useState([])
  const [noteModal, setNoteModal] = useState(null)   // { booking_id, name }
  const [noteDraft, setNoteDraft] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [notesSearch, setNotesSearch] = useState('')
  const [noteDrafts, setNoteDrafts] = useState({})   // inline edits in the Notes tab

  const rowRefs = useRef({})
  const isFirstMount = useRef(true)

  useEffect(() => { fetchData() }, [])
  useEffect(() => {
    if (!document.getElementById('custom-scroll-style')) {
      const s = document.createElement('style')
      s.id = 'custom-scroll-style'
      s.textContent = `.custom-scroll::-webkit-scrollbar{width:3px;height:3px}.custom-scroll::-webkit-scrollbar-track{background:transparent}.custom-scroll::-webkit-scrollbar-thumb{background:#F4C099;border-radius:2px}.custom-scroll::-webkit-scrollbar-thumb:hover{background:#F47920}`
      document.head.appendChild(s)
    }
    if (!document.getElementById('parent-anim-style')) {
      const a = document.createElement('style')
      a.id = 'parent-anim-style'
      a.textContent = `@keyframes cartPop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.08);opacity:1}100%{transform:scale(1);opacity:1}}@keyframes confirmShimmer{0%{transform:translateX(-160%) skewX(-18deg)}100%{transform:translateX(260%) skewX(-18deg)}}`
      document.head.appendChild(a)
    }
  }, [])
  // Cancel any in-flight animation timers on unmount.
  useEffect(() => () => { animTimersRef.current.forEach(clearTimeout) }, [])
  // Persist settings whenever a toggle changes.
  useEffect(() => { writeStoredBool(SETTINGS_KEYS.animations, animationsOn) }, [animationsOn])
  useEffect(() => { writeStoredBool(SETTINGS_KEYS.sound, soundOn) }, [soundOn])

  // Auto-scroll when parent switches the active child pill
  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return }
    if (tab !== 'grid' || !slots.length) return

    const c = CHILDREN[activeChild]
    const prefix = activeChild === 'p' ? '7' : '4'
    const childBookings = bookings
      .filter(bk => bk.status !== 'cancelled' && (bk.section || '').startsWith(prefix))
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))

    let targetTime = null
    if (childBookings.length > 0) {
      targetTime = childBookings[0].start_time
    } else {
      const childGroups = {}
      slots.filter(s => c.teachers.some(t => s.teacher_name?.includes(t))).forEach(s => {
        if (!childGroups[s.teacher_name]) childGroups[s.teacher_name] = []
        childGroups[s.teacher_name].push(s)
      })
      const allCartTimes = new Set(cart.map(c => c.start_time))
      const allBookedTimes = new Set(bookings.filter(b => b.status !== 'cancelled').map(b => b.start_time))
      const freeSlot = Object.values(childGroups).flat()
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
        .find(s => !s.is_blocked && s.booked_count < s.capacity && !allBookedTimes.has(s.start_time) && !allCartTimes.has(s.start_time))
      if (freeSlot) targetTime = freeSlot.start_time
    }

    if (targetTime) {
      setTimeout(() => {
        rowRefs.current[targetTime]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 50)
    }
  }, [activeChild])

  const fetchData = async () => {
    try {
      const [s, b, n] = await Promise.all([getSlots(), getMyBookings(), getMyNotes()])
      setSlots(s); setBookings(b); setNotes(n)
      if (!welcomeChecked) {
        if (b.filter(x => x.status !== 'cancelled').length === 0) setWelcomeModal(true)
        setWelcomeChecked(true)
      }
    } catch { showToast('Failed to load data') }
    setLoading(false)
  }

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  // --- Notes ---
  const noteIds = new Set(notes.map(n => n.booking_id))
  const noteTextFor = bid => notes.find(n => n.booking_id === bid)?.note_text || ''
  const openNote = bk => {
    if (!bk?.id) return
    setNoteModal({ booking_id: bk.id, name: titleName(bk.teacher_name) })
    setNoteDraft(noteTextFor(bk.id))
  }
  const handleSaveNote = async () => {
    if (!noteModal) return
    setSavingNote(true)
    try {
      await saveNoteApi(noteModal.booking_id, noteDraft)
      setNotes(await getMyNotes())
      showToast(noteDraft.trim() ? 'Note saved' : 'Note cleared')
      setNoteModal(null)
    } catch (err) { showToast(err.response?.data?.detail || 'Failed to save note') }
    setSavingNote(false)
  }
  const saveInlineNote = async (bid, textVal) => {
    try {
      await saveNoteApi(bid, textVal)
      setNotes(await getMyNotes())
      setNoteDrafts(prev => { const n = { ...prev }; delete n[bid]; return n })
      showToast(textVal.trim() ? 'Note saved' : 'Note cleared')
    } catch (err) { showToast(err.response?.data?.detail || 'Failed to save note') }
  }
  const filteredNotes = notes.filter(n => {
    const q = notesSearch.trim().toLowerCase()
    if (!q) return true
    const hay = [n.student_name, n.parent_name, n.section, n.grade != null ? `grade ${n.grade}` : '', n.grade, n.teacher_name, n.note_text].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  })

  const bookedSlotIds = new Set(bookings.filter(b => b.status !== 'cancelled').map(b => b.slot_id))
  const slotToBookingId = Object.fromEntries(bookings.filter(b => b.status !== 'cancelled').map(b => [b.slot_id, b.id]))
  const activeBookings = bookings.filter(b => b.status !== 'cancelled')
  const bookedTimes = new Set(activeBookings.map(b => b.start_time))
  const bookedTeacherNames = new Set(activeBookings.map(b => b.teacher_name))

  const cartSlotIds = new Set(cart.map(c => c.slot_id))
  const cartStartTimes = new Set(cart.map(c => c.start_time))
  const cartTeacherNames = new Set(cart.map(c => c.teacher_name))

  const groupByTeacher = (teacherList) => {
    const map = {}
    slots.filter(s => teacherList.some(t => s.teacher_name?.includes(t))).forEach(s => {
      if (!map[s.teacher_name]) map[s.teacher_name] = []
      map[s.teacher_name].push(s)
    })
    return map
  }

  const child = CHILDREN[activeChild]
  const currentTeachers = child.teachers
  const teacherGroups = groupByTeacher(currentTeachers)
  const teachers = Object.keys(teacherGroups)
  const allTimes = [...new Set(Object.values(teacherGroups).flat().map(s => s.start_time))].sort()

  const teacherOptions = [...new Map(slots.map(s => [s.teacher_id, s.teacher_name])).entries()]
    .map(([id, name]) => ({ id, name }))
    .filter(t => currentTeachers.some(ct => t.name?.includes(ct)))

  const slotClass = slot => {
    const isBooked = bookedSlotIds.has(slot.id)
    const isInCart = cartSlotIds.has(slot.id)
    if (isBooked) return activeChild === 'p' ? 'child1' : 'child2'
    if (isInCart) return 'cart'
    if (slot.is_blocked) return 'taken'
    if (slot.booked_count >= slot.capacity) return 'taken'
    if (bookedTimes.has(slot.start_time) || cartStartTimes.has(slot.start_time)) return 'taken'
    if (bookedTeacherNames.has(slot.teacher_name) || cartTeacherNames.has(slot.teacher_name)) return 'taken'
    return 'free'
  }

  const slotUnavailableReason = slot => {
    const isBooked = bookedSlotIds.has(slot.id)
    if (slot.is_blocked && !isBooked) return "This time is blocked by the teacher and can't be booked."
    if (!isBooked && (bookedTimes.has(slot.start_time) || cartStartTimes.has(slot.start_time)))
      return "You already have a meeting (or a slot in your cart) at this time."
    if (!isBooked && (bookedTeacherNames.has(slot.teacher_name) || cartTeacherNames.has(slot.teacher_name)))
      return "You've already booked a meeting with this teacher."
    return "This slot is already taken."
  }

  const handleCartToggle = slot => {
    if (cartSlotIds.has(slot.id)) {
      setCart(prev => prev.filter(c => c.slot_id !== slot.id))
      return
    }
    setCart(prev => [...prev, {
      slot_id: slot.id,
      student_name: child.student_name,
      section: child.section,
      start_time: slot.start_time,
      end_time: slot.end_time,
      teacher_name: slot.teacher_name,
    }])
  }

  const handleConfirm = async () => {
    if (cart.length === 0 || confirming) return
    setConfirming(true)
    try {
      const items = cart.map(c => ({ slot_id: c.slot_id, student_name: c.student_name, section: c.section }))
      const result = await batchBooking(items)
      const bookedIds = new Set(result.booked.map(b => b.slot_id))
      setCart(prev => prev.filter(c => !bookedIds.has(c.slot_id)))
      await fetchData()
      if (result.failed.length > 0) {
        setBatchResult(result)
      } else {
        showToast(`${result.booked.length} meeting${result.booked.length !== 1 ? 's' : ''} booked!`)
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'Booking failed')
    }
    setConfirming(false)
  }

  const handleCancel = async () => {
    if (!cancelModal) return
    try { await cancelBooking(cancelModal.booking_id); showToast('Meeting cancelled'); fetchData() }
    catch { showToast('Failed to cancel') }
    setCancelModal(null)
  }

  const openAutoModal = () => { setSelectedTeachers(new Set(teacherOptions.map(t => t.id))); setAutoResult(null); pendingPicksRef.current = []; setAutoModal(true) }
  const toggleTeacher = id => { setSelectedTeachers(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }

  // Short, subtle "pop" synthesised via Web Audio (no asset). Respects the toggle
  // and swallows any error (autoplay policy, unsupported, etc.).
  const playPop = () => {
    if (!soundOn) return
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      if (!audioCtxRef.current) audioCtxRef.current = new AC()
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') ctx.resume()
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(520, now)
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.05)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.11, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(now); osc.stop(now + 0.2)
    } catch { /* audio unavailable — ignore */ }
  }

  const clearAnimTimers = () => { animTimersRef.current.forEach(clearTimeout); animTimersRef.current = [] }
  const triggerFlourish = () => {
    setConfirmFlourish(true)
    animTimersRef.current.push(setTimeout(() => setConfirmFlourish(false), 750))
  }
  // Stage auto-scheduled picks into the cart. With animations on: one-by-one in
  // chronological order, each popping in over a total of ~1.7s, then a flourish.
  const runCartFillAnimation = (picks) => {
    if (!picks || picks.length === 0) return
    if (!animationsOn) { setCart(prev => [...prev, ...picks]); return }
    clearAnimTimers()
    setCartAnimating(true)
    const POP_MS = 240
    const stagger = 1700 / picks.length
    picks.forEach((pick, i) => {
      animTimersRef.current.push(setTimeout(() => {
        setCart(prev => [...prev, pick])
        setAnimatedInIds(prev => { const n = new Set(prev); n.add(pick.slot_id); return n })
        playPop()
        animTimersRef.current.push(setTimeout(() => {
          setAnimatedInIds(prev => { const n = new Set(prev); n.delete(pick.slot_id); return n })
        }, POP_MS + 40))
        if (i === picks.length - 1) {
          animTimersRef.current.push(setTimeout(() => { setCartAnimating(false); triggerFlourish() }, POP_MS + 40))
        }
      }, i * stagger))
    })
  }
  // Closing the auto modal commits any staged picks (via animation).
  const closeAutoModal = () => {
    setAutoModal(false)
    if (pendingPicksRef.current.length) {
      const picks = pendingPicksRef.current
      pendingPicksRef.current = []
      runCartFillAnimation(picks)
    }
  }

  const handleAutoSchedule = async () => {
    setAutoScheduling(true)
    try {
      const result = await autoSchedule([...selectedTeachers], { student_name: child.student_name, section: child.section }, true)
      const picks = result.picks || []
      const existingSlotIds = new Set(cart.map(c => c.slot_id))
      const existingStartTimes = new Set(cart.map(c => c.start_time))
      // Sort chronologically (earliest first) so the animation reads left-to-right in time.
      pendingPicksRef.current = picks
        .filter(p => !existingSlotIds.has(p.slot_id) && !existingStartTimes.has(p.start_time))
        .map(p => ({
          slot_id: p.slot_id,
          student_name: child.student_name,
          section: child.section,
          start_time: p.start_time,
          end_time: p.end_time,
          teacher_name: p.teacher_name,
        }))
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
      setAutoResult({ picks, conflicts: result.conflicts || [] })
    } catch (err) {
      showToast(err.response?.data?.detail || 'Auto-schedule failed')
    }
    setAutoScheduling(false)
  }

  const userInitials = user?.name ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'PM'
  const doneCount = Object.values(done).filter(Boolean).length
  const bookedCount = activeBookings.length

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
              <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: 'rgba(255,255,255,.65)', marginTop: 2 }}>Inventure Academy · PTM 09 Apr 2026</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px,1.2vw,14px)', flexShrink: 0 }}>
            <button onClick={() => setSettingsOpen(true)} title="Settings" aria-label="Settings" style={{ width: 'clamp(30px,3.6vw,38px)', height: 'clamp(30px,3.6vw,38px)', borderRadius: '50%', background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            </button>
            <button onClick={logoutUser} style={{fontSize:'clamp(10px,1.2vw,13px)',fontWeight:600,padding:'clamp(4px,.8vw,8px) clamp(10px,1.5vw,16px)',borderRadius:20,background:'rgba(255,255,255,.2)',border:'1px solid rgba(255,255,255,.4)',color:'#fff',cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>Sign out</button>
            <img src={LOGO_LARGE} alt="Inventure" style={{ height: 'clamp(24px,3vw,36px)', width: 'auto', filter: 'brightness(0) invert(1)', opacity: .9 }} />
          </div>
        </div>

        {/* MAIN TABS */}
        <div style={{ display: 'flex', background: '#fff', borderBottom: '2px solid #F4C099', flexShrink: 0 }}>
          {[['grid','Book'],['sched','My schedule'],['notes','Notes']].map(([key, lbl]) => (
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
              <div style={{ display: 'flex', gap: 4, background: '#FDEBDA', borderRadius: 50, padding: 3, flexShrink: 0 }}>
                {Object.entries(CHILDREN).map(([key, c]) => (
                  <button key={key} onClick={() => setActiveChild(key)} style={{ fontSize: 'clamp(11px,1.3vw,15px)', fontWeight: 700, padding: 'clamp(5px,.8vw,9px) clamp(12px,1.6vw,20px)', borderRadius: 50, border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all .15s', background: activeChild === key ? (key === 'p' ? '#F47920' : '#2563EB') : 'transparent', color: activeChild === key ? '#fff' : '#C45A0A', boxShadow: activeChild === key ? '0 2px 8px rgba(244,121,32,.3)' : 'none' }}>{c.label} · {c.section}</button>
                ))}
              </div>
              <span style={{ fontSize: 'clamp(11px,1.3vw,15px)', color: '#9CA3AF', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>Tap to add to cart, then Confirm</span>
              <button onClick={openAutoModal} style={{ fontSize: 'clamp(11px,1.3vw,15px)', fontWeight: 700, padding: 'clamp(7px,1vw,12px) clamp(12px,1.6vw,20px)', borderRadius: 50, background: '#1B3F7A', color: '#fff', border: 'none', cursor: 'pointer', marginLeft: 'auto', whiteSpace: 'nowrap', boxShadow: '0 2px 12px rgba(27,63,122,.3)', fontFamily: 'inherit', flexShrink: 0 }}>Auto-schedule</button>
            </div>

            {/* Grid */}
            <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, pointerEvents: cartAnimating ? 'none' : 'auto' }}>
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
                    <tr key={time} ref={el => { rowRefs.current[time] = el }}>
                      <td style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: '#9CA3AF', paddingLeft: 'clamp(10px,1.5vw,18px)', background: '#FFF8F3', fontWeight: 600, borderRight: '2px solid #F4C099', border: '1px solid #F0E4D4', height: 'clamp(32px,4vw,44px)', verticalAlign: 'middle' }}>{fmt(time)}</td>
                      {teachers.map(t => {
                        const slot = teacherGroups[t]?.find(s => s.start_time === time)
                        if (!slot) return <td key={t} style={{ border: '1px solid #F0E4D4', height: 'clamp(32px,4vw,44px)', background: '#F9FAFB' }} />
                        const cls = slotClass(slot)
                        const hov = hoveredCancel === slot.id
                        const isBooked = cls === 'child1' || cls === 'child2'
                        const isCart = cls === 'cart'

                        if (cls === 'taken' && slot.is_blocked) return (
                          <td key={t} style={{ padding: 2, border: '1px solid #F0E4D4', height: 'clamp(32px,4vw,44px)', verticalAlign: 'middle' }}>
                            <div onClick={() => setSlotInfoModal({ message: slotUnavailableReason(slot) })} style={{ width: '100%', height: '100%', borderRadius: 8, background: '#E7E0D8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#A89F94', fontSize: 'clamp(12px,1.5vw,16px)', fontWeight: 700, lineHeight: 1 }}>✕</div>
                          </td>
                        )
                        if (cls === 'taken') return (
                          <td key={t} style={{ padding: 2, border: '1px solid #F0E4D4', height: 'clamp(32px,4vw,44px)', verticalAlign: 'middle' }}>
                            <div onClick={() => setSlotInfoModal({ message: slotUnavailableReason(slot) })} style={{ width: '100%', height: '100%', borderRadius: 8, background: '#F5F0EC', cursor: 'pointer' }} />
                          </td>
                        )

                        return (
                          <td key={t} style={{ padding: 2, border: '1px solid #F0E4D4', height: 'clamp(32px,4vw,44px)', verticalAlign: 'middle' }}>
                            <button
                              onClick={() => {
                                if (cartAnimating) return
                                if (isBooked) { setCancelModal({ booking_id: slotToBookingId[slot.id], teacher: t }); return }
                                handleCartToggle(slot)
                              }}
                              onMouseEnter={() => (isBooked || isCart) && setHoveredCancel(slot.id)}
                              onMouseLeave={() => setHoveredCancel(null)}
                              style={{
                                width: '100%', height: '100%', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                animation: animatedInIds.has(slot.id) ? 'cartPop .24s ease-out' : 'none',
                                border: isBooked
                                  ? (cls === 'child1' ? '2px solid #F47920' : '2px solid #2563EB')
                                  : isCart
                                  ? `2px dashed ${hov ? '#DC2626' : '#F47920'}`
                                  : 'none',
                                cursor: 'pointer',
                                background: hov && (isBooked || isCart) ? '#FEE2E2'
                                  : cls === 'child1' ? '#FFF0E6'
                                  : cls === 'child2' ? '#EFF6FF'
                                  : isCart ? '#FFF8F3'
                                  : 'transparent',
                                color: hov && (isBooked || isCart) ? '#DC2626'
                                  : cls === 'child1' ? '#C45A0A'
                                  : cls === 'child2' ? '#1D4ED8'
                                  : '#E5D5C5',
                                fontSize: 'clamp(11px,1.3vw,14px)',
                                fontWeight: 600,
                                transition: 'all .12s', fontFamily: 'inherit',
                              }}>
                              {isBooked ? (hov ? '×' : '✓') : isCart ? (hov ? '×' : '') : <span style={{ fontSize: 'clamp(16px,2vw,22px)', fontWeight: 300 }}>+</span>}
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
              {[
                { label: child.label, bg: activeChild === 'p' ? '#FFF0E6' : '#EFF6FF', border: activeChild === 'p' ? '#F47920' : '#2563EB', dashed: false },
                { label: 'In cart', bg: '#FFF8F3', border: '#F47920', dashed: true },
                { label: 'Taken', bg: '#F5F0EC', border: '#E5D5C5', dashed: false },
              ].map(l => (
                <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'clamp(11px,1.3vw,14px)', color: '#6B7280', fontWeight: 500 }}>
                  <span style={{ width: 'clamp(14px,1.8vw,20px)', height: 'clamp(14px,1.8vw,20px)', borderRadius: 5, background: l.bg, border: `2px ${l.dashed ? 'dashed' : 'solid'} ${l.border}`, flexShrink: 0, display: 'inline-block' }} />{l.label}
                </span>
              ))}
            </div>

            {/* Bottom bar */}
            <div style={{ padding: 'clamp(12px,1.8vw,18px) clamp(16px,2.5vw,28px)', borderTop: '1px solid #F4C099', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF8F3', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#C45A0A', fontWeight: 600 }}>
                {bookedCount > 0
                  ? `${bookedCount} teacher${bookedCount !== 1 ? 's' : ''} booked`
                  : cart.length > 0
                  ? `${cart.length} slot${cart.length !== 1 ? 's' : ''} in cart`
                  : 'Tap a slot to add to cart'}
              </span>
              <button
                onClick={handleConfirm}
                disabled={cart.length === 0 || confirming}
                style={{
                  position: 'relative', overflow: 'hidden',
                  fontSize: 'clamp(12px,1.5vw,16px)', fontWeight: 700,
                  padding: 'clamp(8px,1.1vw,13px) clamp(14px,2vw,24px)',
                  borderRadius: 50, border: 'none',
                  cursor: cart.length === 0 || confirming ? 'default' : 'pointer',
                  background: confirmFlourish ? '#1B3F7A' : cart.length === 0 || confirming ? '#F4C099' : '#F47920',
                  color: '#fff', fontFamily: 'inherit',
                  boxShadow: confirmFlourish ? '0 2px 16px rgba(27,63,122,.45)' : cart.length > 0 && !confirming ? '0 2px 12px rgba(244,121,32,.35)' : 'none',
                  transition: 'background .3s, box-shadow .3s',
                }}>
                {confirmFlourish && <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '45%', background: 'linear-gradient(100deg, transparent, rgba(255,255,255,.6), transparent)', animation: 'confirmShimmer .7s ease-out', pointerEvents: 'none' }} />}
                <span style={{ position: 'relative' }}>{confirming ? 'Booking…' : `Confirm ${cart.length > 0 ? cart.length + ' ' : ''}slot${cart.length !== 1 ? 's' : ''}`}</span>
              </button>
            </div>
          </div>
        )}

        {/* MY SCHEDULE TAB */}
        {tab === 'sched' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ padding: 'clamp(10px,1.5vw,16px) clamp(16px,2.5vw,28px)', borderBottom: '1px solid #F4C099', background: '#FFF8F3', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 'clamp(13px,1.6vw,17px)', color: '#9CA3AF', fontWeight: 500 }}>{activeBookings.length} upcoming meetings</span>
              <div onClick={() => setColourByChild(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                <span style={{ fontSize: 'clamp(12px,1.4vw,15px)', color: colourByChild ? '#C45A0A' : '#9CA3AF', fontWeight: 600 }}>Colour by child</span>
                <div style={{ width: 38, height: 22, borderRadius: 22, background: colourByChild ? '#F47920' : '#E5D5C5', position: 'relative', transition: 'background .15s', flexShrink: 0 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: colourByChild ? 18 : 2, transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
                </div>
              </div>
            </div>
            <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {activeBookings.length === 0 ? (
                <div style={{ padding: 'clamp(32px,5vw,60px)', textAlign: 'center', color: '#C4B5A5', fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 500 }}>
                  <div style={{ fontSize: 'clamp(36px,5vw,56px)', marginBottom: 10, opacity: .5 }}>📅</div>
                  No bookings yet
                </div>
              ) : [...activeBookings].sort((a,b) => new Date(a.start_time) - new Date(b.start_time)).map(bk => {
                const isDone = done[bk.id]
                const kid = colourByChild ? childKey(bk) : null
                const accent = kid ? CHILD_ACCENT[kid] : null
                const childName = kid ? ((bk.student_name || '').split(' ')[0] || CHILDREN[kid].label) : null
                const barColor = isDone ? '#E5E5E5' : accent || '#F4C099'
                return (
                  <div key={bk.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #F4EDE4', minHeight: 'clamp(62px,8vw,80px)', background: isDone ? '#FAFAFA' : '#fff', transition: 'background .12s' }}>
                    <div style={{ width: 'clamp(60px,8vw,80px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px', flexShrink: 0 }}>
                      <div style={{ fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 700, color: isDone ? '#C4B5A5' : accent || '#1B3F7A', letterSpacing: '-.02em' }}>{fmt(bk.start_time)}</div>
                    </div>
                    <div style={{ width: 3, flexShrink: 0, alignSelf: 'stretch', background: barColor }} />
                    <div style={{ flex: 1, minWidth: 0, padding: 'clamp(8px,1.2vw,12px) clamp(14px,2vw,18px)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 'clamp(14px,1.8vw,20px)', fontWeight: 700, color: isDone ? '#C4B5A5' : '#1B3F7A', letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: isDone ? 'line-through' : 'none', minWidth: 0 }}>{titleName(bk.teacher_name)}</div>
                        {kid && <span style={{ flexShrink: 0, fontSize: 'clamp(9px,1.1vw,12px)', fontWeight: 700, padding: '2px clamp(6px,.9vw,9px)', borderRadius: 20, background: CHILD_PILL[kid].bg, color: CHILD_PILL[kid].text }}>{childName}</span>}
                      </div>
                      <div style={{ fontSize: 'clamp(11px,1.3vw,15px)', color: '#9CA3AF', marginTop: 2 }}>{fmt(bk.start_time)} – {fmt(bk.end_time)}{bk.teacher_venue ? <span style={{ marginLeft: 8 }}>· {bk.teacher_venue}</span> : null}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px,1.5vw,16px)', paddingRight: 'clamp(14px,2vw,22px)', flexShrink: 0 }}>
                      <div onClick={() => setDone(p => ({ ...p, [bk.id]: !p[bk.id] }))} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
                        <div style={{ width: 'clamp(22px,2.8vw,30px)', height: 'clamp(22px,2.8vw,30px)', borderRadius: 6, border: `2px solid ${isDone ? '#F47920' : accent || '#F4C099'}`, background: isDone ? '#FFF0E6' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', flexShrink: 0 }}>
                          {isDone && DONE_TICK}
                        </div>
                      </div>
                      <button onClick={() => openNote(bk)} title={noteIds.has(bk.id) ? 'Edit note' : 'Add note'}
                        style={{ width: 'clamp(28px,3.5vw,38px)', height: 'clamp(28px,3.5vw,38px)', borderRadius: 8, background: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>{noteIcon(noteIds.has(bk.id))}</button>
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
            </div>
          </div>
        )}

        {/* NOTES */}
        {tab === 'notes' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ padding: 'clamp(10px,1.5vw,16px) clamp(16px,2.5vw,28px)', borderBottom: '1px solid #F4C099', background: '#FFF8F3', flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={notesSearch} onChange={e => setNotesSearch(e.target.value)} placeholder="Search notes, teacher, child, grade…"
                style={{ flex: 1, padding: 'clamp(8px,1vw,12px) clamp(12px,1.5vw,16px)', border: '1.5px solid #F4C099', borderRadius: 10, fontSize: 'clamp(13px,1.5vw,15px)', fontFamily: 'inherit', color: '#1B3F7A', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#F47920'} onBlur={e => e.target.style.borderColor = '#F4C099'} />
              {notesSearch && <button onClick={() => setNotesSearch('')} style={{ fontSize: 13, fontWeight: 600, padding: '8px 12px', borderRadius: 10, background: '#fff', color: '#9CA3AF', border: '1.5px solid #E5D5C5', cursor: 'pointer', fontFamily: 'inherit' }}>Clear</button>}
            </div>
            <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
              : notes.length === 0 ? <div style={{ padding: 'clamp(32px,5vw,60px)', textAlign: 'center', color: '#C4B5A5', fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 500 }}>No notes yet. Tap the note icon on a meeting to add one.</div>
              : filteredNotes.length === 0 ? <div style={{ padding: 'clamp(32px,5vw,60px)', textAlign: 'center', color: '#C4B5A5', fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 500 }}>No notes match “{notesSearch}”.</div>
              : filteredNotes.map(n => {
                const draft = noteDrafts[n.booking_id]
                const val = draft !== undefined ? draft : n.note_text
                const changed = draft !== undefined && draft !== n.note_text
                return (
                  <div key={n.booking_id} style={{ padding: 'clamp(12px,1.6vw,18px) clamp(16px,2.5vw,28px)', borderBottom: '1px solid #F4EDE4' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 'clamp(14px,1.7vw,17px)', fontWeight: 700, color: '#1B3F7A', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleName(n.teacher_name)}</div>
                      <div style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: '#C45A0A', fontWeight: 600, flexShrink: 0 }}>{fmt(n.start_time)}</div>
                    </div>
                    <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: '#9CA3AF', marginTop: 1 }}>{[n.student_name, n.section, n.grade != null ? `Gr ${n.grade}` : null].filter(Boolean).join(' · ')}</div>
                    <textarea value={val} onChange={e => setNoteDrafts(prev => ({ ...prev, [n.booking_id]: e.target.value }))} rows={2}
                      placeholder="Write a note…"
                      style={{ width: '100%', marginTop: 8, padding: 'clamp(8px,1vw,12px)', border: '1.5px solid #F4C099', borderRadius: 10, fontSize: 'clamp(13px,1.5vw,15px)', fontFamily: 'inherit', color: '#1B3F7A', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
                      onFocus={e => e.target.style.borderColor = '#F47920'} onBlur={e => e.target.style.borderColor = '#F4C099'} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <button onClick={() => saveInlineNote(n.booking_id, val)} disabled={!changed}
                        style={{ fontSize: 13, fontWeight: 700, padding: '6px 18px', borderRadius: 50, border: 'none', background: changed ? '#F47920' : '#F1E4D6', color: changed ? '#fff' : '#C4B5A5', cursor: changed ? 'pointer' : 'default', fontFamily: 'inherit' }}>Save</button>
                    </div>
                  </div>
                )
              })}
            </div>
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

      {/* NOTE MODAL */}
      {noteModal && (
        <div onClick={() => setNoteModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20, backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 'clamp(20px,3vw,32px)', width: '100%', maxWidth: 'min(440px,calc(100vw - 32px))', boxShadow: '0 12px 40px rgba(0,0,0,.15)' }}>
            <div style={{ fontSize: 'clamp(16px,2vw,22px)', fontWeight: 700, color: '#1B3F7A', marginBottom: 4 }}>Note</div>
            <div style={{ fontSize: 'clamp(12px,1.5vw,15px)', color: '#9CA3AF', marginBottom: 'clamp(12px,1.6vw,16px)' }}>Private to you · {noteModal.name}</div>
            <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} autoFocus rows={5} placeholder="Write a private note about this meeting…"
              style={{ width: '100%', padding: 'clamp(10px,1.4vw,14px)', border: '1.5px solid #F4C099', borderRadius: 12, fontSize: 'clamp(13px,1.6vw,16px)', fontFamily: 'inherit', color: '#1B3F7A', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
              onFocus={e => e.target.style.borderColor = '#F47920'} onBlur={e => e.target.style.borderColor = '#F4C099'} />
            <div style={{ display: 'flex', gap: 12, marginTop: 'clamp(14px,2vw,20px)' }}>
              <button onClick={() => setNoteModal(null)} style={{ flex: 1, padding: 'clamp(11px,1.5vw,15px)', borderRadius: 12, fontSize: 'clamp(13px,1.7vw,17px)', fontWeight: 700, cursor: 'pointer', border: '2px solid #F4C099', background: '#fff', color: '#9CA3AF', fontFamily: 'inherit' }}>Close</button>
              <button onClick={handleSaveNote} disabled={savingNote} style={{ flex: 2, padding: 'clamp(11px,1.5vw,15px)', borderRadius: 12, fontSize: 'clamp(13px,1.7vw,17px)', fontWeight: 700, cursor: savingNote ? 'not-allowed' : 'pointer', opacity: savingNote ? .6 : 1, border: 'none', background: '#F47920', color: '#fff', fontFamily: 'inherit' }}>{savingNote ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {settingsOpen && (
        <div onClick={() => setSettingsOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20, backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 'clamp(22px,3vw,32px)', width: '100%', maxWidth: 'min(380px,calc(100vw - 32px))', boxShadow: '0 12px 40px rgba(0,0,0,.15)' }}>
            <div style={{ fontSize: 'clamp(17px,2.2vw,24px)', fontWeight: 800, color: '#1B3F7A', marginBottom: 4 }}>Settings</div>
            <div style={{ fontSize: 'clamp(12px,1.5vw,15px)', color: '#9CA3AF', marginBottom: 'clamp(16px,2.2vw,22px)' }}>These apply for this session only.</div>
            {[['Animations', 'Slot pop-in when auto-scheduling', animationsOn, setAnimationsOn],
              ['Sound effects', 'A subtle pop as each slot lands', soundOn, setSoundOn]].map(([label, sub, on, set]) => (
              <div key={label} onClick={() => set(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 'clamp(10px,1.4vw,14px) 0', borderBottom: label === 'Animations' ? '1px solid #F4EDE4' : 'none', cursor: 'pointer' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 'clamp(14px,1.7vw,17px)', fontWeight: 700, color: '#1B3F7A' }}>{label}</div>
                  <div style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: '#9CA3AF', marginTop: 1 }}>{sub}</div>
                </div>
                <div style={{ width: 46, height: 26, borderRadius: 26, background: on ? '#F47920' : '#E5D5C5', position: 'relative', transition: 'background .15s', flexShrink: 0 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: on ? 22 : 2, transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
                </div>
              </div>
            ))}
            <button onClick={() => setSettingsOpen(false)} style={{ width: '100%', marginTop: 'clamp(16px,2.2vw,22px)', padding: 'clamp(11px,1.5vw,15px)', borderRadius: 12, fontSize: 'clamp(14px,1.8vw,17px)', fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1B3F7A', color: '#fff', fontFamily: 'inherit' }}>Done</button>
          </div>
        </div>
      )}

      {/* AUTO-SCHEDULE MODAL */}
      {autoModal && (
        <div onClick={closeAutoModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20, backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 'min(400px,calc(100vw - 32px))', boxShadow: '0 12px 40px rgba(0,0,0,.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
            {autoResult === null ? (<>
              <div style={{ padding: 'clamp(18px,2.5vw,28px) clamp(20px,2.8vw,28px) clamp(12px,1.8vw,18px)', borderBottom: '1px solid #F4C099' }}>
                <div style={{ fontSize: 'clamp(16px,2vw,22px)', fontWeight: 800, color: '#1B3F7A' }}>✦ Auto-schedule</div>
                <div style={{ fontSize: 'clamp(12px,1.5vw,15px)', color: '#9CA3AF', marginTop: 4 }}>Pick teachers — we'll add a conflict-free schedule to your cart</div>
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
                <button onClick={closeAutoModal} style={{ flex: 1, padding: 'clamp(10px,1.4vw,14px)', fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 700, background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={handleAutoSchedule} disabled={selectedTeachers.size === 0 || autoScheduling} style={{ flex: 2, padding: 'clamp(10px,1.4vw,14px)', fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 700, background: selectedTeachers.size === 0 || autoScheduling ? '#F4C099' : '#1B3F7A', color: '#fff', border: 'none', borderRadius: 9, cursor: selectedTeachers.size === 0 || autoScheduling ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                  {autoScheduling ? 'Finding slots…' : `Add ${selectedTeachers.size > 0 ? selectedTeachers.size : ''} to cart`}
                </button>
              </div>
            </>) : (<>
              <div style={{ padding: 'clamp(24px,3vw,32px) clamp(20px,2.8vw,28px) clamp(16px,2vw,22px)', textAlign: 'center', borderBottom: '1px solid #FDE9D4' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', margin: '0 auto 10px', background: autoResult.picks.length > 0 ? '#FFF0E6' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: autoResult.picks.length > 0 ? '#C45A0A' : '#9CA3AF' }}>{autoResult.picks.length > 0 ? '✓' : '—'}</div>
                <div style={{ fontSize: 'clamp(16px,2vw,22px)', fontWeight: 800, color: '#1B3F7A' }}>{autoResult.picks.length > 0 ? `Added ${autoResult.picks.length} slot${autoResult.picks.length !== 1 ? 's' : ''} to cart` : 'No slots available'}</div>
                {autoResult.conflicts.length > 0 && <div style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: '#9CA3AF', marginTop: 4 }}>{autoResult.conflicts.length} teacher{autoResult.conflicts.length !== 1 ? 's' : ''} couldn't be scheduled</div>}
              </div>
              <div className="custom-scroll" style={{ overflowY: 'auto', flex: 1, padding: 'clamp(12px,1.8vw,18px) clamp(20px,2.8vw,28px)' }}>
                {autoResult.picks.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < autoResult.picks.length - 1 ? '1px solid #FDE9D4' : 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F47920', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 700, color: '#1B3F7A' }}>{titleName(p.teacher_name)}</div>
                      <div style={{ fontSize: 'clamp(11px,1.3vw,14px)', color: '#9CA3AF', marginTop: 1 }}>{fmt(p.start_time)} – {fmt(p.end_time)}</div>
                    </div>
                    <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', fontWeight: 700, color: '#C45A0A', background: '#FFF0E6', padding: '2px 8px', borderRadius: 20, border: '1.5px dashed #F47920' }}>In cart</div>
                  </div>
                ))}
                {autoResult.conflicts.length > 0 && (
                  <div style={{ marginTop: autoResult.picks.length > 0 ? 14 : 0, background: '#F9FAFB', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 'clamp(9px,1.1vw,12px)', fontWeight: 700, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Could not schedule</div>
                    {autoResult.conflicts.map((name, i) => <div key={i} style={{ fontSize: 'clamp(12px,1.5vw,15px)', color: '#6B7280', padding: '4px 0', borderBottom: i < autoResult.conflicts.length - 1 ? '1px solid #E5E7EB' : 'none' }}>{name}</div>)}
                  </div>
                )}
              </div>
              <div style={{ padding: 'clamp(14px,2vw,20px) clamp(20px,2.8vw,28px)', borderTop: '1px solid #FDE9D4' }}>
                <button onClick={closeAutoModal} style={{ width: '100%', padding: 'clamp(12px,1.6vw,16px)', fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 700, background: '#1B3F7A', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit' }}>Done — review cart</button>
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

      {/* SLOT INFO MODAL */}
      {slotInfoModal && (
        <div onClick={() => setSlotInfoModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20, backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 'clamp(28px,4vw,44px)', width: '100%', maxWidth: 'min(360px,calc(100vw - 32px))', textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,.15)' }}>
            <div style={{ fontSize: 'clamp(32px,4vw,44px)', marginBottom: 14 }}>🚫</div>
            <div style={{ fontSize: 'clamp(16px,2vw,22px)', fontWeight: 700, color: '#1B3F7A', lineHeight: 1.4, marginBottom: 'clamp(20px,3vw,30px)' }}>{slotInfoModal.message}</div>
            <button onClick={() => setSlotInfoModal(null)} style={{ width: '100%', padding: 'clamp(12px,1.6vw,16px)', borderRadius: 12, fontSize: 'clamp(15px,1.9vw,19px)', fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1B3F7A', color: '#fff', fontFamily: 'inherit' }}>OK</button>
          </div>
        </div>
      )}

      {/* BATCH RESULT MODAL — shown when some slots in a confirm failed */}
      {batchResult && (
        <div onClick={() => setBatchResult(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20, backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 'min(380px,calc(100vw - 32px))', boxShadow: '0 12px 40px rgba(0,0,0,.15)', overflow: 'hidden' }}>
            <div style={{ padding: 'clamp(20px,2.8vw,28px)', borderBottom: '1px solid #F4C099' }}>
              <div style={{ fontSize: 'clamp(17px,2.2vw,22px)', fontWeight: 800, color: '#1B3F7A', marginBottom: 4 }}>
                {batchResult.booked.length > 0 ? `${batchResult.booked.length} booked, ${batchResult.failed.length} couldn't be booked` : "Couldn't book these slots"}
              </div>
              <div style={{ fontSize: 'clamp(12px,1.5vw,15px)', color: '#9CA3AF' }}>They may have just been taken — please pick new times.</div>
            </div>
            <div className="custom-scroll" style={{ maxHeight: 240, overflowY: 'auto', padding: 'clamp(12px,1.8vw,18px) clamp(20px,2.8vw,28px)' }}>
              {batchResult.failed.map((f, i) => {
                const cartItem = cart.find(c => c.slot_id === f.slot_id) || {}
                const teacherName = f.teacher_name || cartItem.teacher_name || 'Unknown teacher'
                const reason = FAIL_REASON[f.reason] || f.reason || 'unavailable'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < batchResult.failed.length - 1 ? '1px solid #F4EDE4' : 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F87171', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'clamp(13px,1.6vw,16px)', fontWeight: 600, color: '#1B3F7A' }}>{titleName(teacherName)}</div>
                      <div style={{ fontSize: 'clamp(10px,1.2vw,13px)', color: '#9CA3AF', marginTop: 1, textTransform: 'capitalize' }}>{reason}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ padding: 'clamp(14px,2vw,20px) clamp(20px,2.8vw,28px)', borderTop: '1px solid #F4C099' }}>
              <button onClick={() => setBatchResult(null)} style={{ width: '100%', padding: 'clamp(12px,1.6vw,16px)', borderRadius: 12, fontSize: 'clamp(14px,1.8vw,18px)', fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1B3F7A', color: '#fff', fontFamily: 'inherit' }}>OK</button>
            </div>
          </div>
        </div>
      )}

      <Toast msg={toast} />
    </div>
  )
}
