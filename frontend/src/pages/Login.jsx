import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { login } from '../api/auth'

export default function Login() {
  const { loginUser } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    if (!email || !password) { setError('Please fill in all fields.'); return }
    setLoading(true)
    try {
      const data = await login(email, password)
      loginUser(data.access_token)
      const payload = JSON.parse(atob(data.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      if (payload.role === 'parent') navigate('/parent')
      else if (payload.role === 'teacher') navigate('/teacher')
      else if (payload.role === 'admin') navigate('/admin')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password.')
    }
    setLoading(false)
  }

  const onKey = (e) => { if (e.key === 'Enter') handleSubmit() }

  const inp = {
    width: '100%',
    padding: 'clamp(12px,1.5vw,16px) clamp(14px,1.8vw,18px)',
    fontSize: 'clamp(14px,1.6vw,16px)',
    border: '1.5px solid #F4C099',
    borderRadius: 10,
    outline: 'none',
    fontFamily: 'inherit',
    color: '#1B3F7A',
    background: '#fff',
    boxSizing: 'border-box',
    transition: 'border-color .15s',
  }

  return (
    <div style={{
      minHeight: '100svh', background: '#FFF8F3',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'clamp(16px,3vw,40px)', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, overflow: 'hidden',
        width: '100%', maxWidth: 'clamp(320px,38vw,460px)',
        boxShadow: '0 4px 32px rgba(244,121,32,.12), 0 1px 4px rgba(0,0,0,.06)',
        border: '1px solid #F4C099',
      }}>
        <div style={{
          padding: 'clamp(20px,2.8vw,32px) clamp(20px,2.8vw,36px)',
          background: '#F47920', textAlign: 'center',
        }}>
          <div style={{ fontSize: 'clamp(20px,2.5vw,28px)', fontWeight: 800, color: '#fff', letterSpacing: '-.03em' }}>
            PTM Scheduler
          </div>
          <div style={{ fontSize: 'clamp(12px,1.4vw,15px)', color: 'rgba(255,255,255,.85)', marginTop: 6, fontWeight: 500 }}>
            Inventure Academy · Parent-Teacher Meetings
          </div>
        </div>

        <div style={{
          padding: 'clamp(24px,3vw,36px) clamp(24px,3vw,40px) clamp(28px,3.5vw,40px)',
          display: 'flex', flexDirection: 'column', gap: 'clamp(16px,2vw,22px)',
        }}>
          <div style={{ fontSize: 'clamp(17px,2.2vw,24px)', fontWeight: 700, color: '#1B3F7A', letterSpacing: '-.02em' }}>
            Sign in to your account
          </div>

          <div>
            <label style={{ fontSize: 'clamp(11px,1.2vw,13px)', fontWeight: 700, color: '#1B3F7A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Email</label>
            <input
              type="email" placeholder="you@inventureacademy.in"
              value={email} onChange={e => setEmail(e.target.value)} onKeyDown={onKey}
              onFocus={e => e.target.style.borderColor='#F47920'}
              onBlur={e => e.target.style.borderColor='#F4C099'}
              style={inp}
            />
          </div>

          <div>
            <label style={{ fontSize: 'clamp(11px,1.2vw,13px)', fontWeight: 700, color: '#1B3F7A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Password</label>
            <input
              type="password" placeholder="Your password"
              value={password} onChange={e => setPassword(e.target.value)} onKeyDown={onKey}
              onFocus={e => e.target.style.borderColor='#F47920'}
              onBlur={e => e.target.style.borderColor='#F4C099'}
              style={inp}
            />
          </div>

          {error && (
            <div style={{ fontSize: 'clamp(12px,1.3vw,14px)', color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit} disabled={loading}
            onMouseEnter={e => { if (!loading) e.target.style.background='#E06010' }}
            onMouseLeave={e => { if (!loading) e.target.style.background='#F47920' }}
            style={{
              width: '100%', padding: 'clamp(13px,1.6vw,17px)',
              fontSize: 'clamp(15px,1.7vw,18px)', fontWeight: 700,
              background: '#F47920', color: '#fff', border: 'none', borderRadius: 10,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .6 : 1,
              fontFamily: 'inherit', transition: 'background .15s, opacity .15s',
              boxShadow: '0 2px 12px rgba(244,121,32,.3)',
            }}>
            {loading ? 'Signing in…' : 'Log in'}
          </button>
        </div>
      </div>
    </div>
  )
}
