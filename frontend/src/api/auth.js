import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const login = async (email, password) => {
  const res = await axios.post(`${BASE_URL}/auth/login`, { email, password })
  return res.data
}

export const signup = async (name, email, password, role, invite_code) => {
  const res = await axios.post(`${BASE_URL}/auth/signup`, { name, email, password, role, invite_code })
  return res.data
}

export const loginUser = async ({ email, password }) => login(email, password)
export const signupUser = async ({ name, email, password, role, invite_code }) => signup(name, email, password, role, invite_code)
