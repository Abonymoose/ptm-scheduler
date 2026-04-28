import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { loginUser } from '../api/auth'

export default function Login() {
  const { loginUser: ctxLogin } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sanitize = (str) => str.replace(/[<>"'`;]/g, '').trim()

  const handleSubmit = async () => {
    setError('')
    const cleanEmail = sanitize(email)
    const cleanPassword = sanitize(password)
    if (!cleanEmail || !cleanPassword) { setError('Please fill in all fields.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) { setError('Please enter a valid email.'); return }
    setLoading(true)
    try {
      const data = await loginUser({ email: cleanEmail, password: cleanPassword })
      ctxLogin(data.access_token)
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password.')
    }
    setLoading(false)
  }

  const handleKey = (e) => { if (e.key === 'Enter') handleSubmit() }

  return (
    <div style={{ minHeight: '100svh', background: '#FFF8F3', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(10px,2vw,28px)', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', width: '100%', maxWidth: 'clamp(320px,36vw,460px)', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>

        {/* Orange header */}
        <div style={{ padding: 'clamp(14px,2vw,26px) clamp(16px,2.5vw,32px)', background: '#F47920', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(4px,.6vw,8px)' }}>
          <div style={{ fontSize: 'clamp(18px,2.2vw,26px)', fontWeight: 800, color: '#fff', letterSpacing: '-.02em' }}>PTM Scheduler</div>
          <div style={{ fontSize: 'clamp(12px,1.4vw,15px)', color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: '.02em' }}>Inventure Academy · Parent-Teacher Meetings</div>
        </div>

        {/* Form */}
        <div style={{ padding: 'clamp(20px,2.8vw,36px) clamp(20px,2.8vw,36px) clamp(24px,3vw,40px)', display: 'flex', flexDirection: 'column', gap: 'clamp(14px,1.8vw,22px)' }}>
          <div style={{ fontSize: 'clamp(16px,2vw,22px)', fontWeight: 700, color: '#1B3F7A', letterSpacing: '-.02em' }}>Sign in to your account</div>

          <div>
            <label style={{ fontSize: 'clamp(11px,1.3vw,13px)', fontWeight: 600, color: '#1B3F7A', display: 'block', marginBottom: 'clamp(4px,.5vw,7px)' }}>Email</label>
            <input
              type="email"
              placeholder="you@inventureacademy.in"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKey}
              style={{ width: '100%', padding: 'clamp(10px,1.3vw,14px) clamp(12px,1.6vw,16px)', fontSize: 'clamp(13px,1.5vw,15px)', border: '1.5px solid #F4C099', borderRadius: 10, outline: 'none', fontFamily: 'inherit', color: '#1B3F7A', background: '#fff', boxSizing: 'border-box', transition: 'border-color .15s' }}
              onFocus={e => e.target.style.borderColor = '#F47920'}
              onBlur={e => e.target.style.borderColor = '#F4C099'}
            />
          </div>

          <div>
            <label style={{ fontSize: 'clamp(11px,1.3vw,13px)', fontWeight: 600, color: '#1B3F7A', display: 'block', marginBottom: 'clamp(4px,.5vw,7px)' }}>Password</label>
            <input
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKey}
              style={{ width: '100%', padding: 'clamp(10px,1.3vw,14px) clamp(12px,1.6vw,16px)', fontSize: 'clamp(13px,1.5vw,15px)', border: '1.5px solid #F4C099', borderRadius: 10, outline: 'none', fontFamily: 'inherit', color: '#1B3F7A', background: '#fff', boxSizing: 'border-box', transition: 'border-color .15s' }}
              onFocus={e => e.target.style.borderColor = '#F47920'}
              onBlur={e => e.target.style.borderColor = '#F4C099'}
            />
          </div>

          {error && (
            <div style={{ fontSize: 'clamp(11px,1.3vw,13px)', color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>{error}</div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ width: '100%', padding: 'clamp(12px,1.5vw,16px)', fontSize: 'clamp(14px,1.6vw,17px)', fontWeight: 700, background: '#F47920', color: '#fff', border: 'none', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .55 : 1, fontFamily: 'inherit', transition: 'opacity .15s, transform .1s' }}
            onMouseEnter={e => { if (!loading) e.target.style.opacity = '.9' }}
            onMouseLeave={e => { if (!loading) e.target.style.opacity = '1' }}
          >
            {loading ? 'Signing in…' : 'Log in'}
          </button>
        </div>
      </div>
    </div>
  )
}
