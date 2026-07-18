import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })

export const wipeBookings = async () => {
  const res = await axios.post(`${BASE_URL}/demo/wipe-bookings`, {}, authHeader())
  return res.data
}

export const resetSlots = async () => {
  const res = await axios.post(`${BASE_URL}/demo/reset-slots`, {}, authHeader())
  return res.data
}

export const getChangelog = async () => {
  const res = await axios.get(`${BASE_URL}/demo/changelog`, authHeader())
  return res.data
}
