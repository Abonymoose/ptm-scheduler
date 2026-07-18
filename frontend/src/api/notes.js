import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })

export const getNote = async (bookingId) => {
  const res = await axios.get(`${BASE_URL}/notes/${bookingId}`, authHeader())
  return res.data
}

export const saveNote = async (bookingId, noteText) => {
  const res = await axios.put(`${BASE_URL}/notes/${bookingId}`, { note_text: noteText }, authHeader())
  return res.data
}

export const getMyNotes = async () => {
  const res = await axios.get(`${BASE_URL}/notes`, authHeader())
  return res.data
}
