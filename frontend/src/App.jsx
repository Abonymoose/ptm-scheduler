import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import { getSchoolBySlug } from './api/auth'
import ParentDashboard from './pages/ParentDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import AdminDashboard from './pages/AdminDashboard'

const homeFor = (role) => (role === 'admin' ? '/admin' : role === 'teacher' ? '/teacher' : role === 'parent' ? '/parent' : '/inventure')

function ProtectedRoute({ children, role }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/inventure" />
  // A logged-in user on the wrong dashboard goes to their own — not to /inventure.
  // This also makes the impersonation swap land cleanly instead of bouncing.
  if (role && user.role !== role) return <Navigate to={homeFor(user.role)} />
  return children
}

// Branded per-school login at /:slug (e.g. /inventure). Looks the school up by
// slug: a known slug renders the branded Login (bare header + footer). Renders
// nothing until the lookup resolves so the header doesn't flip.
//
// Failure modes are deliberately split: a 404 (unknown school) renders the 404
// page, but ANY other failure (500, network drop, timeout) falls back to the
// UNBRANDED login so people can still sign in. Since /login was removed, this is
// the only entry point — a branding lookup must never be able to block auth.
//
// Landing paths (/privacy, /how-it-works, /faq, /) never reach here — nginx serves
// them via `location =` exact matches that outrank the SPA fallback, so React
// never mounts for them.
function BrandedLogin() {
  const { slug } = useParams()
  const [state, setState] = useState('loading') // 'loading' | 'branded' | 'notfound' | 'plain'
  useEffect(() => {
    let alive = true
    getSchoolBySlug(slug)
      .then(() => { if (alive) setState('branded') })
      .catch((err) => {
        if (!alive) return
        setState(err.response?.status === 404 ? 'notfound' : 'plain')
      })
    return () => { alive = false }
  }, [slug])
  if (state === 'loading') return null
  if (state === 'notfound') return <NotFound />
  return <Login branded={state === 'branded'} />
}

// Persistent, obvious banner shown on every dashboard while impersonating.
function ImpersonationBanner() {
  const { impersonation, endImpersonation } = useAuth()
  const navigate = useNavigate()
  if (!impersonation) return null
  const returnToAdmin = () => {
    const restored = endImpersonation()
    navigate(restored ? '/admin' : '/inventure')
  }
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100000, background: '#1B3F7A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(8px,1.5vw,16px)', padding: 'clamp(6px,1vw,9px) clamp(12px,2vw,20px)', fontSize: 'clamp(12px,1.5vw,15px)', fontWeight: 600, boxShadow: '0 2px 12px rgba(0,0,0,.25)', flexWrap: 'wrap' }}>
      <span>👁 Viewing as <strong>{impersonation.name}</strong> ({impersonation.role})</span>
      <button onClick={returnToAdmin} style={{ background: '#fff', color: '#1B3F7A', border: 'none', borderRadius: 20, padding: 'clamp(3px,.6vw,6px) clamp(12px,1.8vw,18px)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'clamp(11px,1.3vw,14px)', flexShrink: 0 }}>Return to admin</button>
    </div>
  )
}

export default function App() {
  return (
    <>
      <ImpersonationBanner />
      <Routes>
        <Route path="/parent" element={<ProtectedRoute role="parent"><ParentDashboard /></ProtectedRoute>} />
        <Route path="/teacher" element={<ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/:slug" element={<BrandedLogin />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}
