import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const authHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
})

export const createBooking = async (slot_id, child = {}) => {
  const res = await axios.post(`${BASE_URL}/bookings/`, { slot_id, student_name: child.student_name, section: child.section }, authHeader())
  return res.data
}

export const getMyBookings = async () => {
  const res = await axios.get(`${BASE_URL}/bookings/`, authHeader())
  return res.data
}

export const cancelBooking = async (bookingId) => {
  const res = await axios.delete(`${BASE_URL}/bookings/${bookingId}`, authHeader())
  return res.data
}

export const getAllBookings = async () => {
  const res = await axios.get(`${BASE_URL}/bookings/all`, authHeader())
  return res.data
}

export const setAttendance = async (bookingId, attendance) => {
  const res = await axios.patch(`${BASE_URL}/bookings/${bookingId}/attendance`, { attendance }, authHeader())
  return res.data
}

export const autoSchedule = async (teacherIds, child = {}) => {
  const res = await axios.post(`${BASE_URL}/bookings/auto-schedule`, { teacher_ids: teacherIds, student_name: child.student_name, section: child.section }, authHeader())
  return res.data
}
