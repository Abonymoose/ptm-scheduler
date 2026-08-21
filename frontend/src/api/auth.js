import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const requestOtp = async (email) => {
  const res = await axios.post(`${BASE_URL}/auth/request-otp`, { email })
  return res.data
}

export const verifyOtp = async (email, code) => {
  const res = await axios.post(`${BASE_URL}/auth/verify-otp`, { email, code })
  return res.data
}

export const adminLogin = async (email, password) => {
  const res = await axios.post(`${BASE_URL}/auth/admin-login`, { email, password })
  return res.data
}

// Public — powers branded login pages. Rejects (404) on an unknown slug.
export const getSchoolBySlug = async (slug) => {
  const res = await axios.get(`${BASE_URL}/schools/by-slug/${slug}`)
  return res.data
}

const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })

export const getMe = async () => {
  const res = await axios.get(`${BASE_URL}/auth/me`, authHeader())
  return res.data
}
