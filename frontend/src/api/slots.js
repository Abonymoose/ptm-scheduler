import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const authHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
})

export const getSlots = async () => {
  const res = await axios.get(`${BASE_URL}/slots/`, authHeader())
  return res.data
}
