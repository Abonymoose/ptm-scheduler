import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAllSlots } from '../api/slots'
import { getAllBookings } from '../api/bookings'

const INVITE_CODE = 'INVENT-2026'

function fmt(isoStr) {
  return new Date(isoStr).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true
  })
}

function fmtDate(isoStr) {
  return new Date(isoStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short'
  })
}

export default function AdminDashboard() {
  const { logoutUser } = useAuth()
  const [slots, setSlots] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [expandedTeacher, setExpandedTeacher] = useState(null)
  const [expandedBooking, setExpandedBooking] = useState(null)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const [slotsData, bookingsData] = await Promise.all([getAllSlots(), getAllBookings()])
      setSlots(slotsData)
      setBookings(bookingsData)
    } catch {
      showToast('Failed to load data')
    }
    setLoading(false)
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(INVITE_CODE).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Derive stats
  const confirmedBookings = bookings.filter(b => b.status !== 'cancelled')
  const totalBookings = confirmedBookings.length
  const totalSlots = slots.length

  // Group slots by teacher for Overview
  const teacherMap = {}
  slots.forEach(s => {
    if (!teacherMap[s.teacher_name]) teacherMap[s.teacher_name] = []
    teacherMap[s.teacher_name].push(s)
  })
  const teachers = Object.keys(teacherMap).sort()
  const totalTeachers = teachers.length

  const avgFillRate = totalSlots > 0
    ? Math.round((totalBookings / totalSlots) * 100)
    : 0

  // Group confirmed bookings by teacher for expanded view
  const bookingsByTeacher = {}
  confirmedBookings.forEach(b => {
    if (!bookingsByTeacher[b.teacher_name]) bookingsByTeacher[b.teacher_name] = []
    bookingsByTeacher[b.teacher_name].push(b)
  })

  // Filtered bookings for All Bookings tab
  const filteredBookings = bookings.filter(b => {
    const q = search.toLowerCase()
    return b.parent_name.toLowerCase().includes(q) || b.teacher_name.toLowerCase().includes(q)
  })

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#FFF8F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#F47920', fontSize: '13px', fontWeight: '600' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#FFF8F3', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>

      {/* Topbar */}
      <div style={{ background: '#F47920', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '10px', fontWeight: '700', color: '#fff',
            border: '1.5px solid rgba(255,255,255,0.5)'
          }}>
            IA
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#fff', lineHeight: '1.2' }}>Inventure Academy</div>
            <div style={{ fontSize: '10px', color: '#FFE0C0', lineHeight: '1.2' }}>Admin · PTM 09 Apr 2026</div>
          </div>
        </div>
        <button
          onClick={logoutUser}
          style={{ fontSize: '11px', background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '6px', padding: '4px 11px', cursor: 'pointer', fontWeight: '600' }}
        >
          Logout
        </button>
      </div>

      {/* Stats strip */}
      <div style={{ background: '#fff', borderBottom: '1px solid #F4C099', padding: '10px 16px', display: 'flex', flexShrink: 0 }}>
        {[
          { label: 'Teachers', value: totalTeachers },
          { label: 'Bookings', value: totalBookings, color: '#F47920' },
          { label: 'Slots', value: totalSlots, color: '#1B3F7A' },
          { label: 'Fill rate', value: `${avgFillRate}%`, color: avgFillRate >= 75 ? '#16a34a' : avgFillRate >= 40 ? '#F47920' : '#9CA3AF' },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', borderRight: i < 3 ? '1px solid #FDE9D4' : 'none' }}>
            <div style={{ fontSize: '18px', fontWeight: '800', color: s.color || '#1B3F7A', lineHeight: '1.1' }}>{s.value}</div>
            <div style={{ fontSize: '9px', color: '#9CA3AF', marginTop: '2px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #F4C099', display: 'flex', flexShrink: 0 }}>
        {[['overview', 'Overview'], ['bookings', 'All Bookings']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1, padding: '10px', fontSize: '12px', fontWeight: '700',
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === key ? '#F47920' : '#9CA3AF',
              borderBottom: tab === key ? '2px solid #F47920' : '2px solid transparent',
              transition: 'color 0.15s'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>

        {/* Overview tab */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {teachers.length === 0 && (
              <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '13px', marginTop: '40px' }}>
                No slots created yet.
              </div>
            )}

            {teachers.map(teacher => {
              const teacherSlots = teacherMap[teacher]
              const slotCount = teacherSlots.length
              const bookedCount = teacherSlots.reduce((sum, s) => sum + Number(s.booked_count), 0)
              const totalCap = teacherSlots.reduce((sum, s) => sum + Number(s.capacity), 0)
              const pct = totalCap > 0 ? Math.round((bookedCount / totalCap) * 100) : 0
              const isExpanded = expandedTeacher === teacher
              const teacherBookings = bookingsByTeacher[teacher] || []

              return (
                <div key={teacher} style={{
                  background: '#fff', borderRadius: '10px',
                  border: '1px solid #F4C099',
                  overflow: 'hidden',
                  boxShadow: '0 1px 4px rgba(244,121,32,0.06)'
                }}>
                  <button
                    onClick={() => setExpandedTeacher(isExpanded ? null : teacher)}
                    style={{
                      width: '100%', padding: '12px 14px', display: 'flex', alignItems: 'center',
                      gap: '12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left'
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                      background: '#FFF0E6', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: '#C45A0A'
                    }}>
                      {teacher.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#1B3F7A' }}>{teacher}</div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: pct >= 75 ? '#16a34a' : pct > 0 ? '#F47920' : '#9CA3AF', marginLeft: '8px' }}>
                          {pct}%
                        </div>
                      </div>
                      <div style={{ fontSize: '10px', color: '#9CA3AF', marginBottom: '5px' }}>
                        {slotCount} slot{slotCount !== 1 ? 's' : ''} · {bookedCount} booked
                      </div>
                      {/* Fill bar */}
                      <div style={{ height: '4px', background: '#F3F4F6', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: '2px',
                          width: `${pct}%`,
                          background: pct >= 75 ? '#16a34a' : pct > 0 ? '#F47920' : '#E5E7EB',
                          transition: 'width 0.3s'
                        }} />
                      </div>
                    </div>

                    <div style={{ fontSize: '14px', color: '#9CA3AF', flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                      ▾
                    </div>
                  </button>

                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #FDE9D4', padding: '8px 14px 12px' }}>
                      {teacherBookings.length === 0
                        ? <div style={{ fontSize: '11px', color: '#9CA3AF' }}>No bookings yet.</div>
                        : teacherBookings.map((bk, i) => (
                          <div key={bk.id || i} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '6px 0',
                            borderBottom: i < teacherBookings.length - 1 ? '1px solid #FDE9D4' : 'none'
                          }}>
                            <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', minWidth: '80px' }}>
                              {fmt(bk.start_time)}
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#1B3F7A', flex: 1 }}>
                              {bk.parent_name}
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              )
            })}

            {/* Invite code card */}
            <div style={{
              marginTop: '8px', background: '#fff', borderRadius: '10px',
              border: '1px solid #F4C099', padding: '14px 16px',
              boxShadow: '0 1px 4px rgba(244,121,32,0.06)'
            }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                School invite code
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  flex: 1, fontFamily: 'monospace', fontSize: '16px', fontWeight: '800',
                  color: '#1B3F7A', letterSpacing: '2px', background: '#FFF8F3',
                  border: '1px solid #F4C099', borderRadius: '8px', padding: '8px 12px'
                }}>
                  {INVITE_CODE}
                </div>
                <button
                  onClick={handleCopyCode}
                  style={{
                    padding: '8px 14px', fontSize: '12px', fontWeight: '700',
                    background: copied ? '#FFF0E6' : '#F47920',
                    color: copied ? '#C45A0A' : '#fff',
                    border: copied ? '1px solid #F4C099' : 'none',
                    borderRadius: '8px', cursor: 'pointer',
                    transition: 'background 0.2s, color 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '6px' }}>
                Share this code with parents and teachers to join the school.
              </div>
            </div>
          </div>
        )}

        {/* All Bookings tab */}
        {tab === 'bookings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Search bar */}
            <div style={{ position: 'relative', marginBottom: '4px' }}>
              <input
                type="text"
                placeholder="Search parent or teacher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '9px 11px 9px 34px',
                  fontSize: '13px', border: '1px solid #F4C099',
                  borderRadius: '10px', background: '#fff', color: '#1B3F7A',
                  outline: 'none', fontFamily: 'system-ui, sans-serif',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#F4C099', fontSize: '14px', pointerEvents: 'none' }}>
                ⌕
              </div>
            </div>

            {filteredBookings.length === 0 && (
              <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '13px', marginTop: '40px' }}>
                {search ? 'No results.' : 'No bookings yet.'}
              </div>
            )}

            {filteredBookings.map((bk, i) => {
              const isExpanded = expandedBooking === bk.id
              const isCancelled = bk.status === 'cancelled'
              return (
                <div key={bk.id || i} style={{
                  background: '#fff', borderRadius: '10px',
                  border: `1px solid ${isCancelled ? '#E5E7EB' : '#F4C099'}`,
                  overflow: 'hidden',
                  opacity: isCancelled ? 0.65 : 1,
                  boxShadow: isCancelled ? 'none' : '0 1px 4px rgba(244,121,32,0.06)'
                }}>
                  <button
                    onClick={() => setExpandedBooking(isExpanded ? null : bk.id)}
                    style={{
                      width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center',
                      gap: '10px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left'
                    }}
                  >
                    {/* Time block */}
                    <div style={{
                      minWidth: '48px', textAlign: 'center', background: isCancelled ? '#F3F4F6' : '#FFF0E6',
                      borderRadius: '6px', padding: '4px 6px', flexShrink: 0
                    }}>
                      <div style={{ fontSize: '10px', fontWeight: '800', color: isCancelled ? '#9CA3AF' : '#C45A0A', lineHeight: '1.1' }}>
                        {fmt(bk.start_time)}
                      </div>
                      <div style={{ fontSize: '9px', color: isCancelled ? '#D1D5DB' : '#F4C099', marginTop: '1px' }}>
                        {fmtDate(bk.start_time)}
                      </div>
                    </div>

                    {/* Names */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#1B3F7A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {bk.parent_name}
                      </div>
                      <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '1px' }}>
                        with {bk.teacher_name}
                      </div>
                    </div>

                    {/* Status pill */}
                    <div style={{
                      fontSize: '10px', fontWeight: '700', padding: '3px 9px', borderRadius: '20px',
                      background: isCancelled ? '#F3F4F6' : '#FFF0E6',
                      color: isCancelled ? '#9CA3AF' : '#C45A0A',
                      flexShrink: 0
                    }}>
                      {isCancelled ? 'Cancelled' : 'Confirmed'}
                    </div>

                    <div style={{ fontSize: '14px', color: '#9CA3AF', flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                      ▾
                    </div>
                  </button>

                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #FDE9D4', padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {[
                        ['Parent', bk.parent_name],
                        ['Teacher', bk.teacher_name],
                        ['Slot', `${fmt(bk.start_time)} – ${fmt(bk.end_time)}, ${fmtDate(bk.start_time)}`],
                        ['Status', bk.status.charAt(0).toUpperCase() + bk.status.slice(1)],
                      ].map(([label, value]) => (
                        <div key={label} style={{ display: 'flex', gap: '8px' }}>
                          <div style={{ fontSize: '11px', color: '#9CA3AF', minWidth: '56px', fontWeight: '500' }}>{label}</div>
                          <div style={{ fontSize: '11px', color: '#1B3F7A', fontWeight: '600' }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{
        background: '#fff', borderTop: '1px solid #F4C099',
        padding: '10px 16px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0,
        boxShadow: '0 -2px 8px rgba(244,121,32,0.07)'
      }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#1B3F7A' }}>
            {totalBookings} booking{totalBookings !== 1 ? 's' : ''} · {totalSlots} slot{totalSlots !== 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '1px' }}>
            {totalTeachers} teacher{totalTeachers !== 1 ? 's' : ''} · {avgFillRate}% fill rate
          </div>
        </div>
        <button
          onClick={() => showToast('Coming soon')}
          style={{
            fontSize: '12px', fontWeight: '700',
            background: '#F47920', color: '#fff',
            border: 'none', borderRadius: '8px',
            padding: '8px 18px', cursor: 'pointer'
          }}
        >
          + Add teacher
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '70px', left: '50%', transform: 'translateX(-50%)',
          background: '#FFF0E6', border: '1px solid #F4C099', color: '#C45A0A',
          fontSize: '11px', padding: '8px 18px', borderRadius: '20px', fontWeight: '600',
          boxShadow: '0 2px 12px rgba(244,121,32,0.15)', whiteSpace: 'nowrap', zIndex: 200
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
