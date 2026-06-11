import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { login } from '../api/auth'
import { LOGO_LARGE } from '../assets/logos'

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

  const onKey = e => { if (e.key === 'Enter') handleSubmit() }

  const inp = { width: '100%', padding: 'clamp(10px,1.3vw,14px) clamp(12px,1.6vw,16px)', fontSize: 'clamp(13px,1.5vw,15px)', border: '1.5px solid #F4C099', borderRadius: 10, outline: 'none', fontFamily: 'inherit', transition: 'border-color .15s, box-shadow .15s', color: '#1B3F7A', background: '#fff', boxSizing: 'border-box' }

  return (
    <div style={{ minHeight: '100vh', background: '#FFF8F3', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(10px,2vw,28px)', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', width: '100%', maxWidth: 'clamp(320px,36vw,460px)', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>

        <div style={{ padding: 'clamp(14px,2vw,26px) clamp(16px,2.5vw,32px)', background: '#F47920', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(4px,.6vw,8px)' }}>
          <img src={LOGO_LARGE} alt="Inventure Academy" style={{ height: 'clamp(38px,5vw,56px)', width: 'auto', display: 'block', filter: 'brightness(0) invert(1)' }} />
          <div style={{ fontSize: 'clamp(12px,1.4vw,15px)', color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: '.02em' }}>PTM Scheduler</div>
        </div>

        <div style={{ padding: 'clamp(16px,2.2vw,28px) clamp(20px,2.8vw,36px)', display: 'flex', flexDirection: 'column', gap: 'clamp(12px,1.6vw,20px)' }}>
          <div style={{ fontSize: 'clamp(16px,2vw,22px)', fontWeight: 700, color: '#1B3F7A', letterSpacing: '-.02em', lineHeight: 1.15 }}>Sign in to your account</div>

          <div>
            <label style={{ fontSize: 'clamp(11px,1.3vw,13px)', fontWeight: 600, color: '#1B3F7A', display: 'block', marginBottom: 'clamp(4px,.5vw,7px)' }}>Email</label>
            <input type="email" placeholder="you@inventureacademy.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={onKey}
              onFocus={e => { e.target.style.borderColor = '#F47920'; e.target.style.boxShadow = '0 0 0 3px rgba(244,121,32,.12)' }}
              onBlur={e => { e.target.style.borderColor = '#F4C099'; e.target.style.boxShadow = 'none' }}
              style={inp} />
          </div>

          <div>
            <label style={{ fontSize: 'clamp(11px,1.3vw,13px)', fontWeight: 600, color: '#1B3F7A', display: 'block', marginBottom: 'clamp(4px,.5vw,7px)' }}>Password</label>
            <input type="password" placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={onKey}
              onFocus={e => { e.target.style.borderColor = '#F47920'; e.target.style.boxShadow = '0 0 0 3px rgba(244,121,32,.12)' }}
              onBlur={e => { e.target.style.borderColor = '#F4C099'; e.target.style.boxShadow = 'none' }}
              style={inp} />
          </div>

          {error && <div style={{ fontSize: 'clamp(11px,1.3vw,13px)', color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>{error}</div>}

          <button onClick={handleSubmit} disabled={loading} style={{ width: '100%', padding: 'clamp(12px,1.5vw,16px)', fontSize: 'clamp(14px,1.6vw,17px)', fontWeight: 700, background: '#F47920', color: '#fff', border: 'none', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .55 : 1, fontFamily: 'inherit', letterSpacing: '-.01em' }}>
            {loading ? 'Signing in…' : 'Log in'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: '#F4C099' }} />
            <span style={{ fontSize: 'clamp(11px,1.3vw,13px)', color: '#C4B5A5', fontWeight: 500 }}>or</span>
            <div style={{ flex: 1, height: 1, background: '#F4C099' }} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, opacity: .45, cursor: 'not-allowed' }}>
              <button disabled style={{ width: '100%', padding: 'clamp(10px,1.3vw,14px)', fontSize: 'clamp(12px,1.4vw,14px)', fontWeight: 600, background: '#fff', color: '#374151', border: '1.5px solid #E5E7EB', borderRadius: 10, cursor: 'not-allowed', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </button>
              <div style={{ textAlign: 'center', fontSize: 'clamp(9px,1vw,11px)', color: '#9CA3AF', marginTop: 4, fontWeight: 500 }}>Coming soon</div>
            </div>
            <div style={{ flex: 1, opacity: .45, cursor: 'not-allowed' }}>
              <button disabled style={{ width: '100%', padding: 'clamp(10px,1.3vw,14px)', fontSize: 'clamp(12px,1.4vw,14px)', fontWeight: 600, background: '#fff', color: '#374151', border: '1.5px solid #E5E7EB', borderRadius: 10, cursor: 'not-allowed', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 814 1000" fill="#000"><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 442.9 26.4 320.7 26.4 200.5c0-187.5 122.4-286.4 244.6-286.4 62.2 0 113.7 40.8 152.4 40.8 36.6 0 94-43.1 163.4-43.1 26.4 0 108.2 2.6 164 100.2zm-138.9-199.5c31.3-37 53.1-88.5 53.1-139.9 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.9-55.1 135.3 0 7.7 1.3 15.5 1.9 18 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-70.4z"/></svg>
                Continue with Apple
              </button>
              <div style={{ textAlign: 'center', fontSize: 'clamp(9px,1vw,11px)', color: '#9CA3AF', marginTop: 4, fontWeight: 500 }}>Coming soon</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
