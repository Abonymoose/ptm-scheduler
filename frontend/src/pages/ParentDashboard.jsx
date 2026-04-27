import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSlots } from '../api/slots'
import { createBooking, getMyBookings, cancelBooking } from '../api/bookings'

const CHILDREN = ['Parshv Gr7', 'Dhriti Gr4']

export default function ParentDashboard() {
  const { user, logoutUser } = useAuth()
  const [slots, setSlots] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [child, setChild] = useState(CHILDREN[0])
  const [hoveredCancel, setHoveredCancel] = useState(null)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const [slotsData, bookingsData] = await Promise.all([getSlots(), getMyBookings()])
      setSlots(slotsData)
      setBookings(bookingsData)
    } catch {
      setError('Failed to load data')
    }
    setLoading(false)
  }

  const activeBookings = bookings.filter(b => b.status !== 'cancelled')
  const bookedSlotIds = new Set(activeBookings.map(b => b.slot_id))
  const slotToBookingId = Object.fromEntries(activeBookings.map(b => [b.slot_id, b.id]))

  const groupByTeacher = () => {
    const map = {}
    slots.forEach(s => {
      if (!map[s.teacher_name]) map[s.teacher_name] = []
      map[s.teacher_name].push(s)
    })
    return map
  }

  const handleBook = async (slot_id) => {
    try {
      await createBooking(slot_id)
      showToast('Booking confirmed!')
      fetchData()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Booking failed')
    }
  }

  const handleCancel = async (slot_id) => {
    const bookingId = slotToBookingId[slot_id]
    if (!bookingId) return
    try {
      await cancelBooking(bookingId)
      showToast('Booking cancelled')
      fetchData()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Cancel failed')
    }
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const teacherGroups = groupByTeacher()
  const teachers = Object.keys(teacherGroups)
  const bookedCount = bookings.filter(b => b.status !== 'cancelled').length
  const allTimes = [...new Set(slots.map(s => s.start_time))].sort()

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#FFF8F3',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'#F47920',fontSize:'13px',fontWeight:'600'}}>Loading...</div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#FFF8F3',display:'flex',flexDirection:'column'}}>

      {/* Topbar */}
      <div style={{background:'#F47920',padding:'8px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{width:'30px',height:'30px',borderRadius:'50%',background:'rgba(255,255,255,0.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:'700',color:'#fff',border:'1.5px solid rgba(255,255,255,0.5)'}}>
            PM
          </div>
          <div>
            <div style={{fontSize:'12px',fontWeight:'700',color:'#fff',lineHeight:'1.2'}}>Paras Mehta</div>
            <div style={{fontSize:'10px',color:'#FFE0C0',lineHeight:'1.2'}}>Inventure Academy · PTM 09 Apr 2026</div>
          </div>
        </div>
        <button onClick={logoutUser} style={{fontSize:'11px',background:'rgba(255,255,255,0.2)',color:'#fff',border:'1px solid rgba(255,255,255,0.4)',borderRadius:'6px',padding:'4px 11px',cursor:'pointer',fontWeight:'600'}}>
          Logout
        </button>
      </div>

      {/* Controls bar */}
      <div style={{background:'#fff',borderBottom:'1px solid #F4C099',padding:'8px 16px',display:'flex',alignItems:'center',gap:'10px',flexShrink:0}}>
        <div style={{fontSize:'11px',fontWeight:'600',color:'#1B3F7A',marginRight:'2px'}}>Child:</div>
        <select
          value={child}
          onChange={e => setChild(e.target.value)}
          style={{fontSize:'11px',fontWeight:'600',color:'#1B3F7A',border:'1px solid #F4C099',borderRadius:'6px',padding:'3px 8px',background:'#FFF8F3',cursor:'pointer',outline:'none'}}
        >
          {CHILDREN.map(c => <option key={c}>{c}</option>)}
        </select>
        <div style={{flex:1}} />
        <button style={{fontSize:'11px',fontWeight:'700',background:'#1B3F7A',color:'#fff',border:'none',borderRadius:'7px',padding:'5px 14px',cursor:'pointer'}}>
          ✦ Auto-schedule
        </button>
      </div>

      {/* Legend */}
      <div style={{padding:'7px 16px',display:'flex',alignItems:'center',gap:'14px',background:'#FFF8F3',borderBottom:'1px solid #FDE9D4',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:'5px'}}>
          <div style={{width:'14px',height:'14px',borderRadius:'3px',background:'#FFF0E6',border:'1.5px solid #F47920'}} />
          <span style={{fontSize:'10px',color:'#9CA3AF'}}>Your slot</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'5px'}}>
          <div style={{width:'14px',height:'14px',borderRadius:'3px',background:'#FFF8F3',border:'1px solid #F4C099'}} />
          <span style={{fontSize:'10px',color:'#9CA3AF'}}>Available</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'5px'}}>
          <div style={{width:'14px',height:'14px',borderRadius:'3px',background:'#F3F4F6',border:'1px solid #E5E7EB'}} />
          <span style={{fontSize:'10px',color:'#9CA3AF'}}>Taken</span>
        </div>
        {error && <div style={{marginLeft:'auto',color:'#E24B4A',fontSize:'10px'}}>{error}</div>}
      </div>

      {/* Grid */}
      <div style={{flex:1,overflowX:'auto',padding:'0'}}>
        <div style={{maxWidth:'900px',margin:'0 auto',padding:'10px 12px'}}>
          <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed'}}>
            <thead>
              <tr>
                <th style={{
                  width:'54px',fontSize:'10px',fontWeight:'700',color:'#1B3F7A',
                  padding:'6px 4px 6px 8px',textAlign:'left',
                  borderBottom:'2px solid #F4C099',background:'#FFF8F3',position:'sticky',left:0,zIndex:1
                }}>Time</th>
                {teachers.map(t => (
                  <th key={t} style={{
                    fontSize:'10px',fontWeight:'700',color:'#1B3F7A',
                    padding:'6px 3px',textAlign:'center',
                    borderBottom:'2px solid #F4C099',background:'#FFF8F3',
                    lineHeight:'1.3'
                  }}>
                    <div>{t.split(' ')[0]}</div>
                    <div style={{fontSize:'9px',fontWeight:'400',color:'#9CA3AF'}}>{t.split(' ').slice(1).join(' ')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allTimes.map((time, rowIdx) => (
                <tr key={time} style={{background: rowIdx % 2 === 0 ? '#fff' : '#FFFAF7'}}>
                  <td style={{
                    fontSize:'10px',color:'#6B7280',paddingLeft:'8px',
                    background: rowIdx % 2 === 0 ? '#FFF8F3' : '#FFF3EC',
                    borderRight:'2px solid #F4C099',
                    border:'1px solid #FDE9D4',
                    height:'30px',whiteSpace:'nowrap',
                    position:'sticky',left:0,zIndex:1
                  }}>
                    {new Date(time).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit', hour12:true})}
                  </td>
                  {teachers.map(t => {
                    const slot = teacherGroups[t].find(s => s.start_time === time)
                    if (!slot) return <td key={t} style={{border:'1px solid #FDE9D4',height:'30px',background:'#FAFAFA'}} />
                    const isBooked = bookedSlotIds.has(slot.id)
                    const isFull = slot.booked_count >= slot.capacity
                    return (
                      <td key={t} style={{padding:'2px',border:'1px solid #FDE9D4',height:'30px'}}>
                        <button
                          onClick={() => {
                            if (isBooked) handleCancel(slot.id)
                            else if (!isFull) handleBook(slot.id)
                          }}
                          onMouseEnter={() => isBooked && setHoveredCancel(slot.id)}
                          onMouseLeave={() => setHoveredCancel(null)}
                          title={isBooked ? 'Click to cancel' : isFull ? 'Slot taken' : 'Click to book'}
                          style={{
                            width:'100%',height:'100%',borderRadius:'4px',
                            border: isBooked ? '1.5px solid #F47920' : '1px solid transparent',
                            cursor: isFull && !isBooked ? 'default' : 'pointer',
                            background: isBooked && hoveredCancel === slot.id ? '#FEE2E2' : isBooked ? '#FFF0E6' : isFull ? '#F3F4F6' : '#FFF8F3',
                            color: isBooked && hoveredCancel === slot.id ? '#DC2626' : isBooked ? '#C45A0A' : isFull ? '#D1D5DB' : '#F4C099',
                            fontSize:'10px',fontWeight: isBooked ? '700' : '500',
                            transition:'background 0.1s, color 0.1s'
                          }}
                        >
                          {isBooked && hoveredCancel === slot.id ? '×' : isBooked ? '✓' : isFull ? '—' : '+'}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        background:'#fff',borderTop:'1px solid #F4C099',
        padding:'10px 16px',display:'flex',alignItems:'center',
        justifyContent:'space-between',flexShrink:0,
        boxShadow:'0 -2px 8px rgba(244,121,32,0.07)'
      }}>
        <div>
          <div style={{fontSize:'13px',fontWeight:'700',color:'#1B3F7A'}}>
            {bookedCount} of {teachers.length} teachers booked
          </div>
          <div style={{fontSize:'10px',color:'#9CA3AF',marginTop:'1px'}}>
            {teachers.length - bookedCount} remaining
          </div>
        </div>
        <button
          disabled={bookedCount === 0}
          style={{
            fontSize:'12px',fontWeight:'700',
            background: bookedCount > 0 ? '#F47920' : '#F4C099',
            color:'#fff',border:'none',borderRadius:'8px',
            padding:'8px 22px',cursor: bookedCount > 0 ? 'pointer' : 'default',
            transition:'background 0.2s'
          }}
        >
          Confirm bookings
        </button>
      </div>

      {toast && (
        <div style={{
          position:'fixed',bottom:'70px',left:'50%',transform:'translateX(-50%)',
          background:'#FFF0E6',border:'1px solid #F4C099',color:'#C45A0A',
          fontSize:'11px',padding:'8px 18px',borderRadius:'20px',fontWeight:'600',
          boxShadow:'0 2px 12px rgba(244,121,32,0.15)',whiteSpace:'nowrap'
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
