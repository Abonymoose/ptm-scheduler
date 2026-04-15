import axios from 'axios'

const BASE_URL = 'http://127.0.0.1:8000'

export const login = async (email, password) => {
  const res = await axios.post(`${BASE_URL}/auth/login`, { email, password })
  return res.data
}

export const signup = async (name, email, password, role, invite_code) => {
  const res = await axios.post(`${BASE_URL}/auth/signup`, { name, email, password, role, invite_code })
  return res.data
}
