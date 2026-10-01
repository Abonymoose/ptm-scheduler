import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })

// [{ id, name, section, grade, teachers: [{ id, name, subject }] }]
export const getChildren = async () => {
  const res = await axios.get(`${BASE_URL}/parent/children`, authHeader())
  return res.data
}
