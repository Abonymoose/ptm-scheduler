import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })

export const getTeacherSlots = async (teacherId) => {
  const res = await axios.get(`${BASE_URL}/admin/teachers/${teacherId}/slots`, authHeader())
  return res.data
}

export const updateTeacher = async (teacherId, data) => {
  const res = await axios.patch(`${BASE_URL}/admin/teachers/${teacherId}`, data, authHeader())
  return res.data
}

export const cancelSlot = async (slotId) => {
  const res = await axios.delete(`${BASE_URL}/admin/slots/${slotId}`, authHeader())
  return res.data
}

export const blockSlot = async (slotId) => {
  const res = await axios.post(`${BASE_URL}/slots/${slotId}/block`, {}, authHeader())
  return res.data
}

export const unblockSlot = async (slotId) => {
  const res = await axios.post(`${BASE_URL}/slots/${slotId}/unblock`, {}, authHeader())
  return res.data
}
