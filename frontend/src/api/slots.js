import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const authHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
})

export const getSlots = async () => {
  const res = await axios.get(`${BASE_URL}/slots/`, authHeader())
  return res.data
}

export const createSlot = async (start_time, end_time, capacity = 1) => {
  const res = await axios.post(`${BASE_URL}/slots/`, { start_time, end_time, capacity }, authHeader())
  return res.data
}

export const getMySlots = async () => {
  const res = await axios.get(`${BASE_URL}/slots/mine`, authHeader())
  return res.data
}

export const getAllSlots = async () => {
  const res = await axios.get(`${BASE_URL}/slots/all`, authHeader())
  return res.data
}
