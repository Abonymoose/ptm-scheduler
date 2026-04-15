import axios from 'axios'

const BASE_URL = 'http://127.0.0.1:8000'

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
