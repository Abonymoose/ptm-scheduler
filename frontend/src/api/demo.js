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

export const addTeacher = async (payload) => {
  const res = await axios.post(`${BASE_URL}/demo/add-teacher`, payload, authHeader())
  return res.data
}

export const seedData = async (teacherId, fillPercent) => {
  const res = await axios.post(`${BASE_URL}/demo/seed-data`, { teacher_id: teacherId, fill_percent: fillPercent }, authHeader())
  return res.data
}

export const wipeSeedData = async () => {
  const res = await axios.post(`${BASE_URL}/demo/wipe-seed-data`, {}, authHeader())
  return res.data
}

export const getDemoUsers = async () => {
  const res = await axios.get(`${BASE_URL}/demo/users`, authHeader())
  return res.data
}

export const impersonate = async (userId) => {
  const res = await axios.post(`${BASE_URL}/demo/impersonate`, { user_id: userId }, authHeader())
  return res.data
}
