import { createContext, useContext, useState, useEffect, useRef } from 'react'

const AuthContext = createContext()

// Decode a JWT payload into { user, impersonation } (or null if invalid).
const decodeToken = (t) => {
  try {
    const p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return {
      user: { id: p.sub, role: p.role, school_id: p.school_id, name: p.name, section: p.section, grade: p.grade, family_id: p.family_id, parent_name: p.parent_name },
      impersonation: p.impersonated_by ? { name: p.name, role: p.role } : null,
    }
  } catch { return null }
}

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  // Decode synchronously on first render so ProtectedRoute never sees a stale/null
  // user for a valid token (avoids a redirect-to-login flash on refresh/impersonate).
  const initial = token ? decodeToken(token) : null
  const [user, setUser] = useState(initial ? initial.user : null)
  const [impersonation, setImpersonation] = useState(initial ? initial.impersonation : null)
  const adminStashRef = useRef(null)

  useEffect(() => {
    if (!token) { setUser(null); setImpersonation(null); return }
    const decoded = decodeToken(token)
    if (!decoded) { localStorage.removeItem('token'); setToken(null); return }
    setUser(decoded.user)
    setImpersonation(decoded.impersonation)
  }, [token])

  const loginUser = (accessToken) => {
    localStorage.setItem('token', accessToken)
    setToken(accessToken)
  }

  const logoutUser = () => {
    adminStashRef.current = null
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    setImpersonation(null)
  }

  // Swap into a target user's session, stashing the current (admin) token in memory
  // (NOT localStorage). Apply user + token together so route guards see the target.
  const beginImpersonation = (targetToken) => {
    adminStashRef.current = token
    const decoded = decodeToken(targetToken)
    localStorage.setItem('token', targetToken)
    if (decoded) { setUser(decoded.user); setImpersonation(decoded.impersonation) }
    setToken(targetToken)
  }

  // Restore the stashed admin token. Returns true if restored, false if the stash
  // is gone (e.g. after a refresh) — caller should then send the user to login.
  const endImpersonation = () => {
    const stash = adminStashRef.current
    adminStashRef.current = null
    if (stash) {
      const decoded = decodeToken(stash)
      localStorage.setItem('token', stash)
      if (decoded) { setUser(decoded.user); setImpersonation(decoded.impersonation) }
      setToken(stash)
      return true
    }
    logoutUser()
    return false
  }

  return (
    <AuthContext.Provider value={{ user, token, impersonation, loginUser, logoutUser, beginImpersonation, endImpersonation }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
