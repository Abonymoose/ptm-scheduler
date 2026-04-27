import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const authHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
})

export const createBooking = async (slot_id) => {
  const res = await axios.post(`${BASE_URL}/bookings/`, { slot_id }, authHeader())
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

export const autoSchedule = async (teacherIds) => {
  const res = await axios.post(`${BASE_URL}/bookings/auto-schedule`, { teacher_ids: teacherIds }, authHeader())
  return res.data
}
