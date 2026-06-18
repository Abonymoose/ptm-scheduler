import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { requestOtp, verifyOtp, adminLogin } from '../api/auth'
import { LOGO_LARGE } from '../assets/logos'

export default function Login() {
  const { loginUser } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)        // 1 = email/(password), 2 = OTP
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)  // reveal password field for admins
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const redirectByRole = (token) => {
    loginUser(token)
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.role === 'parent') navigate('/parent')
    else if (payload.role === 'teacher') navigate('/teacher')
    else if (payload.role === 'admin') navigate('/admin')
  }

  const handleSendOtp = async () => {
    setError('')
    if (!email) { setError('Please enter your email.'); return }
    if (isAdmin && !password) { setError('Please enter your password.'); return }
    setLoading(true)
    try {
      if (isAdmin) {
        await adminLogin(email, password)
      } else {
        await requestOtp(email)
      }
      setStep(2)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (!isAdmin && err.response?.status === 400 && detail === 'Admins use password login') {
        setIsAdmin(true)
        setError('This is an admin account — enter your password to continue.')
      } else {
        setError(detail || 'Could not send the code. Please try again.')
      }
    }
    setLoading(false)
  }

  const handleVerify = async () => {
    setError('')
    if (!code || code.length < 6) { setError('Enter the 6-digit code.'); return }
    setLoading(true)
    try {
      const data = await verifyOtp(email, code)
      redirectByRole(data.access_token)
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired code.')
    }
    setLoading(false)
  }

  const backToEmail = () => { setStep(1); setCode(''); setError('') }

  const onKey = e => { if (e.key === 'Enter') (step === 1 ? handleSendOtp() : handleVerify()) }

  const inp = { width: '100%', padding: 'clamp(10px,1.3vw,14px) clamp(12px,1.6vw,16px)', fontSize: 'clamp(13px,1.5vw,15px)', border: '1.5px solid #F4C099', borderRadius: 10, outline: 'none', fontFamily: 'inherit', transition: 'border-color .15s, box-shadow .15s', color: '#1B3F7A', background: '#fff', boxSizing: 'border-box' }
  const focusOn = e => { e.target.style.borderColor = '#F47920'; e.target.style.boxShadow = '0 0 0 3px rgba(244,121,32,.12)' }
  const focusOff = e => { e.target.style.borderColor = '#F4C099'; e.target.style.boxShadow = 'none' }
  const label = { fontSize: 'clamp(11px,1.3vw,13px)', fontWeight: 600, color: '#1B3F7A', display: 'block', marginBottom: 'clamp(4px,.5vw,7px)' }

  return (
    <div style={{ minHeight: '100vh', background: '#FFF8F3', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(10px,2vw,28px)', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', width: '100%', maxWidth: 'clamp(320px,36vw,460px)', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>

        <div style={{ padding: 'clamp(14px,2vw,26px) clamp(16px,2.5vw,32px)', background: '#F47920', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(4px,.6vw,8px)' }}>
          <img src={LOGO_LARGE} alt="Inventure Academy" style={{ height: 'clamp(38px,5vw,56px)', width: 'auto', display: 'block', filter: 'brightness(0) invert(1)' }} />
          <div style={{ fontSize: 'clamp(12px,1.4vw,15px)', color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: '.02em' }}>PTM Scheduler</div>
        </div>

        <div style={{ padding: 'clamp(16px,2.2vw,28px) clamp(20px,2.8vw,36px)', display: 'flex', flexDirection: 'column', gap: 'clamp(12px,1.6vw,20px)' }}>

          {step === 1 ? (<>
            <div style={{ fontSize: 'clamp(16px,2vw,22px)', fontWeight: 700, color: '#1B3F7A', letterSpacing: '-.02em', lineHeight: 1.15 }}>Sign in to your account</div>

            <div>
              <label style={label}>Email</label>
              <input type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={onKey}
                onFocus={focusOn} onBlur={focusOff} style={inp} />
            </div>

            {isAdmin && (
              <div>
                <label style={label}>Password</label>
                <input type="password" placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={onKey}
                  onFocus={focusOn} onBlur={focusOff} style={inp} />
              </div>
            )}

            {error && <div style={{ fontSize: 'clamp(11px,1.3vw,13px)', color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>{error}</div>}

            <button onClick={handleSendOtp} disabled={loading} style={{ width: '100%', padding: 'clamp(12px,1.5vw,16px)', fontSize: 'clamp(14px,1.6vw,17px)', fontWeight: 700, background: '#F47920', color: '#fff', border: 'none', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .55 : 1, fontFamily: 'inherit', letterSpacing: '-.01em' }}>
              {loading ? 'Sending…' : 'Send OTP'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: '#F4C099' }} />
              <span style={{ fontSize: 'clamp(11px,1.3vw,13px)', color: '#C4B5A5', fontWeight: 500 }}>or</span>
              <div style={{ flex: 1, height: 1, background: '#F4C099' }} />
            </div>

            <button disabled title="Coming soon" style={{ width: '100%', height: 44, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'not-allowed', opacity: .5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 'clamp(13px,1.5vw,15px)', fontWeight: 500, color: '#000', fontFamily: 'inherit' }}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Sign in with Google
            </button>
          </>) : (<>
            <div style={{ fontSize: 'clamp(16px,2vw,22px)', fontWeight: 700, color: '#1B3F7A', letterSpacing: '-.02em', lineHeight: 1.15 }}>Enter your code</div>
            <div style={{ fontSize: 'clamp(12px,1.4vw,15px)', color: '#9CA3AF', marginTop: -8 }}>Enter the 6-digit code sent to <span style={{ color: '#1B3F7A', fontWeight: 600 }}>{email}</span></div>

            <div>
              <label style={label}>6-digit code</label>
              <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={onKey}
                onFocus={focusOn} onBlur={focusOff}
                style={{ ...inp, textAlign: 'center', letterSpacing: '.5em', fontSize: 'clamp(18px,2.4vw,24px)', fontWeight: 700 }} />
            </div>

            {error && <div style={{ fontSize: 'clamp(11px,1.3vw,13px)', color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>{error}</div>}

            <button onClick={handleVerify} disabled={loading} style={{ width: '100%', padding: 'clamp(12px,1.5vw,16px)', fontSize: 'clamp(14px,1.6vw,17px)', fontWeight: 700, background: '#F47920', color: '#fff', border: 'none', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .55 : 1, fontFamily: 'inherit', letterSpacing: '-.01em' }}>
              {loading ? 'Verifying…' : 'Verify'}
            </button>

            <button onClick={backToEmail} style={{ background: 'none', border: 'none', color: '#C45A0A', fontSize: 'clamp(12px,1.4vw,15px)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center' }}>← Back</button>
          </>)}

        </div>
      </div>
    </div>
  )
}
