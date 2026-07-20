import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import ParentDashboard from './pages/ParentDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import AdminDashboard from './pages/AdminDashboard'

const homeFor = (role) => (role === 'admin' ? '/admin' : role === 'teacher' ? '/teacher' : role === 'parent' ? '/parent' : '/login')

function ProtectedRoute({ children, role }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" />
  // A logged-in user on the wrong dashboard goes to their own — not to /login.
  // This also makes the impersonation swap land cleanly instead of bouncing.
  if (role && user.role !== role) return <Navigate to={homeFor(user.role)} />
  return children
}

// Persistent, obvious banner shown on every dashboard while impersonating.
function ImpersonationBanner() {
  const { impersonation, endImpersonation } = useAuth()
  const navigate = useNavigate()
  if (!impersonation) return null
  const returnToAdmin = () => {
    const restored = endImpersonation()
    navigate(restored ? '/admin' : '/login')
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
        <Route path="/login" element={<Login />} />
        <Route path="/parent" element={<ProtectedRoute role="parent"><ParentDashboard /></ProtectedRoute>} />
        <Route path="/teacher" element={<ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </>
  )
}
