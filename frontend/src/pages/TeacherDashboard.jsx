import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getMySlots, createSlot } from '../api/slots'

function fmt(isoStr) {
  return new Date(isoStr).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true
  })
}

function fmtDate(isoStr) {
  return new Date(isoStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

export default function TeacherDashboard() {
  const { user, logoutUser } = useAuth()
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('schedule')
  const [expanded, setExpanded] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Derive teacher name from JWT — the token only carries sub/role/school_id,
  // so we fall back to a display placeholder until we wire a /me endpoint.
  const teacherName = user?.name || 'Teacher'

  // Add-slot form state
  const [form, setForm] = useState({
    date: '',
    startTime: '',
    endTime: '',
    capacity: '1'
  })

  useEffect(() => { fetchSlots() }, [])

  const fetchSlots = async () => {
    try {
      const data = await getMySlots()
      setSlots(data)
    } catch {
      showToast('Failed to load slots')
    }
    setLoading(false)
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const handleAddSlot = async () => {
    if (!form.date || !form.startTime || !form.endTime) {
      showToast('Fill in all fields')
      return
    }
    const start = new Date(`${form.date}T${form.startTime}:00`)
    const end = new Date(`${form.date}T${form.endTime}:00`)
    if (end <= start) {
      showToast('End time must be after start time')
      return
    }
    setSubmitting(true)
    try {
      await createSlot(start.toISOString(), end.toISOString(), parseInt(form.capacity))
      showToast('Slot created!')
      setDrawerOpen(false)
      setForm({ date: '', startTime: '', endTime: '', capacity: '1' })
      fetchSlots()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to create slot')
    }
    setSubmitting(false)
  }

  const totalSlots = slots.length
  const bookedSlots = slots.filter(s => s.booked_count > 0).length
  const freeSlots = totalSlots - bookedSlots
  const fillRate = totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0

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
            {initials(teacherName)}
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#fff', lineHeight: '1.2' }}>{teacherName}</div>
            <div style={{ fontSize: '10px', color: '#FFE0C0', lineHeight: '1.2' }}>Inventure Academy · PTM 09 Apr 2026</div>
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
      <div style={{ background: '#fff', borderBottom: '1px solid #F4C099', padding: '10px 16px', display: 'flex', gap: '0', flexShrink: 0 }}>
        {[
          { label: 'Total slots', value: totalSlots },
          { label: 'Booked', value: bookedSlots, color: '#F47920' },
          { label: 'Free', value: freeSlots, color: '#1B3F7A' },
          { label: 'Fill rate', value: `${fillRate}%`, color: fillRate >= 75 ? '#16a34a' : fillRate >= 40 ? '#F47920' : '#9CA3AF' },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', borderRight: i < 3 ? '1px solid #FDE9D4' : 'none' }}>
            <div style={{ fontSize: '18px', fontWeight: '800', color: s.color || '#1B3F7A', lineHeight: '1.1' }}>{s.value}</div>
            <div style={{ fontSize: '9px', color: '#9CA3AF', marginTop: '2px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #F4C099', display: 'flex', flexShrink: 0 }}>
        {[['schedule', 'My Schedule'], ['manage', 'Manage Slots']].map(([key, label]) => (
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

        {/* My Schedule tab */}
        {tab === 'schedule' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {slots.length === 0 && (
              <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '13px', marginTop: '40px' }}>
                No slots yet. Add one below.
              </div>
            )}
            {slots.map(slot => {
              const parent = slot.bookings?.[0]
              const isBooked = slot.booked_count > 0
              return (
                <div key={slot.id} style={{
                  background: '#fff', borderRadius: '10px',
                  border: `1px solid ${isBooked ? '#F4C099' : '#E5E7EB'}`,
                  padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px',
                  boxShadow: isBooked ? '0 1px 6px rgba(244,121,32,0.08)' : 'none'
                }}>
                  {/* Status dot */}
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                    background: isBooked ? '#F47920' : '#E5E7EB'
                  }} />
                  {/* Time */}
                  <div style={{ minWidth: '100px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#1B3F7A' }}>
                      {fmt(slot.start_time)} – {fmt(slot.end_time)}
                    </div>
                    <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '1px' }}>
                      {fmtDate(slot.start_time)}
                    </div>
                  </div>
                  {/* Parent */}
                  <div style={{ flex: 1 }}>
                    {isBooked
                      ? <span style={{ fontSize: '12px', fontWeight: '600', color: '#C45A0A' }}>{parent?.parent_name || '—'}</span>
                      : <span style={{ fontSize: '12px', color: '#D1D5DB' }}>—</span>
                    }
                  </div>
                  {/* Badge */}
                  <div style={{
                    fontSize: '10px', fontWeight: '700', padding: '3px 9px', borderRadius: '20px',
                    background: isBooked ? '#FFF0E6' : '#F3F4F6',
                    color: isBooked ? '#C45A0A' : '#9CA3AF'
                  }}>
                    {isBooked ? 'Booked' : 'Free'}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Manage Slots tab */}
        {tab === 'manage' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {slots.length === 0 && (
              <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '13px', marginTop: '40px' }}>
                No slots yet. Add one below.
              </div>
            )}
            {slots.map(slot => {
              const pct = slot.capacity > 0 ? Math.round((slot.booked_count / slot.capacity) * 100) : 0
              const isExpanded = expanded === slot.id
              return (
                <div key={slot.id} style={{
                  background: '#fff', borderRadius: '10px',
                  border: '1px solid #F4C099',
                  overflow: 'hidden',
                  boxShadow: '0 1px 4px rgba(244,121,32,0.06)'
                }}>
                  {/* Row header */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : slot.id)}
                    style={{
                      width: '100%', padding: '12px 14px', display: 'flex', alignItems: 'center',
                      gap: '12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#1B3F7A' }}>
                        {fmt(slot.start_time)} – {fmt(slot.end_time)}
                      </div>
                      {/* Fill bar */}
                      <div style={{ marginTop: '5px', height: '4px', background: '#F3F4F6', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: '2px',
                          width: `${pct}%`,
                          background: pct === 100 ? '#F47920' : pct > 0 ? '#FFA05A' : '#E5E7EB',
                          transition: 'width 0.3s'
                        }} />
                      </div>
                      <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '3px' }}>
                        {slot.booked_count} / {slot.capacity} booked · {pct}% full
                      </div>
                    </div>
                    <div style={{ fontSize: '14px', color: '#9CA3AF', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                      ▾
                    </div>
                  </button>

                  {/* Expanded parent list */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #FDE9D4', padding: '8px 14px 12px' }}>
                      {slot.bookings.length === 0
                        ? <div style={{ fontSize: '11px', color: '#9CA3AF' }}>No bookings yet.</div>
                        : slot.bookings.map((bk, i) => (
                          <div key={bk.booking_id || i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: i < slot.bookings.length - 1 ? '1px solid #FDE9D4' : 'none' }}>
                            <div style={{
                              width: '24px', height: '24px', borderRadius: '50%',
                              background: '#FFF0E6', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', fontSize: '9px', fontWeight: '700', color: '#C45A0A', flexShrink: 0
                            }}>
                              {initials(bk.parent_name)}
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#1B3F7A' }}>{bk.parent_name}</div>
                          </div>
                        ))
                      }
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
            {bookedSlots} of {totalSlots} slots booked
          </div>
          <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '1px' }}>
            {freeSlots} remaining
          </div>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            fontSize: '12px', fontWeight: '700',
            background: '#F47920', color: '#fff',
            border: 'none', borderRadius: '8px',
            padding: '8px 18px', cursor: 'pointer'
          }}
        >
          + Add slot
        </button>
      </div>

      {/* Add slot drawer */}
      {drawerOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setDrawerOpen(false) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100,
            display: 'flex', alignItems: 'flex-end'
          }}
        >
          <div style={{
            width: '100%', background: '#fff', borderRadius: '16px 16px 0 0',
            padding: '20px 20px 28px', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#1B3F7A' }}>New slot</div>
              <button
                onClick={() => setDrawerOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', color: '#9CA3AF', cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280' }}>Date</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  style={inputStyle}
                />
              </label>

              <div style={{ display: 'flex', gap: '10px' }}>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280' }}>Start time</span>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    style={inputStyle}
                  />
                </label>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280' }}>End time</span>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    style={inputStyle}
                  />
                </label>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280' }}>Capacity</span>
                <select
                  value={form.capacity}
                  onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                  style={inputStyle}
                >
                  {[1, 2, 3, 4, 5].map(n => (
                    <option key={n} value={n}>{n} parent{n > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </label>

              <button
                onClick={handleAddSlot}
                disabled={submitting}
                style={{
                  marginTop: '4px', width: '100%', padding: '12px',
                  background: submitting ? '#F4C099' : '#F47920',
                  color: '#fff', border: 'none', borderRadius: '10px',
                  fontSize: '14px', fontWeight: '700', cursor: submitting ? 'default' : 'pointer',
                  transition: 'background 0.15s'
                }}
              >
                {submitting ? 'Creating...' : 'Create slot'}
              </button>
            </div>
          </div>
        </div>
      )}

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

const inputStyle = {
  width: '100%', padding: '9px 11px', fontSize: '13px',
  border: '1px solid #F4C099', borderRadius: '8px',
  background: '#FFF8F3', color: '#1B3F7A', outline: 'none',
  fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box'
}
