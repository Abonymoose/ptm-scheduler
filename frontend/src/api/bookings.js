import axios from 'axios'

const BASE_URL = 'http://127.0.0.1:8000'

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
