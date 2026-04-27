import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { loginUser, signupUser } from '../api/auth'

const C = {
  orange: '#F47920',
  navy: '#1B3F7A',
  bg: '#FFF8F3',
  border: '#F4C099',
  lightOrange: '#FFF0E6',
  red: '#DC2626',
  redBg: '#FEF2F2',
  redBorder: '#FECACA',
  grey: '#9CA3AF',
}

export default function Login() {
  const { loginUser: ctxLogin } = useAuth()
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [role, setRole] = useState('parent')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const inp = {
    width: '100%',
    padding: 'clamp(10px,1.3vw,14px) clamp(12px,1.6vw,16px)',
    fontSize: 'clamp(13px,1.5vw,15px)',
    border: `1.5px solid ${C.border}`,
    borderRadius: 10,
    outline: 'none',
    fontFamily: 'inherit',
    color: C.navy,
    background: '#fff',
    boxSizing: 'border-box',
  }

  const label = {
    fontSize: 'clamp(11px,1.3vw,13px)',
    fontWeight: 600,
    color: C.navy,
    display: 'block',
    marginBottom: 'clamp(4px,.5vw,7px)',
  }

  const handleSubmit = async () => {
    setError('')
    if (!email || !password) { setError('Please fill in all fields.'); return }
    if (tab === 'signup' && !name) { setError('Please enter your name.'); return }
    setLoading(true)
    try {
      let data
      if (tab === 'login') {
        data = await loginUser({ email, password })
      } else {
        data = await signupUser({ name, email, password, role, invite_code: inviteCode })
      }
      ctxLogin(data.access_token)
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong.')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100svh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(10px,2vw,28px)', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', width: '100%', maxWidth: 'clamp(320px,36vw,460px)', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
        <div style={{ padding: 'clamp(14px,2vw,26px) clamp(16px,2.5vw,32px)', background: C.orange, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(4px,.6vw,8px)' }}>
          <div style={{ fontSize: 'clamp(18px,2.2vw,26px)', fontWeight: 800, color: '#fff', letterSpacing: '-.02em' }}>PTM Scheduler</div>
          <div style={{ fontSize: 'clamp(12px,1.4vw,15px)', color: 'rgba(255,255,255,.9)', fontWeight: 600 }}>Inventure Academy</div>
        </div>
        <div style={{ display: 'flex', borderBottom: `2px solid ${C.border}` }}>
          {[['login', 'Log in'], ['signup', 'Sign up']].map(([key, lbl]) => (
            <div key={key} onClick={() => { setTab(key); setError('') }} style={{ flex: 1, padding: 'clamp(10px,1.4vw,16px)', textAlign: 'center', fontSize: 'clamp(13px,1.5vw,16px)', fontWeight: 600, cursor: 'pointer', color: tab === key ? C.orange : C.grey, borderBottom: `3px solid ${tab === key ? C.orange : 'transparent'}`, marginBottom: -2, transition: 'all .15s' }}>{lbl}</div>
          ))}
        </div>
        <div style={{ padding: 'clamp(16px,2.2vw,28px) clamp(20px,2.8vw,36px)', display: 'flex', flexDirection: 'column', gap: 'clamp(12px,1.6vw,20px)' }}>
          <div style={{ fontSize: 'clamp(16px,2vw,22px)', fontWeight: 700, color: C.navy, letterSpacing: '-.02em' }}>{tab === 'login' ? 'Sign in to your account' : 'Create your account'}</div>
          {tab === 'signup' && <div><label style={label}>Full name</label><input style={inp} type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} /></div>}
          <div><label style={label}>Email</label><input style={inp} type="email" placeholder="you@inventureacademy.in" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div><label style={label}>Password</label><input style={inp} type="password" placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} /></div>
          {tab === 'signup' && <>
            <div><label style={label}>I am a</label>
              <div style={{ display: 'flex', gap: 'clamp(6px,1vw,10px)' }}>
                {['parent', 'teacher', 'admin'].map(r => (
                  <div key={r} onClick={() => setRole(r)} style={{ flex: 1, padding: 'clamp(8px,1vw,12px)', fontSize: 'clamp(12px,1.3vw,14px)', fontWeight: 600, border: `1.5px solid ${role === r ? C.orange : C.border}`, borderRadius: 10, background: role === r ? C.lightOrange : '#fff', color: role === r ? '#C45A0A' : C.grey, cursor: 'pointer', textAlign: 'center', textTransform: 'capitalize', transition: 'all .12s' }}>{r}</div>
                ))}
              </div>
            </div>
            <div><label style={label}>Invite code</label><input style={inp} type="text" placeholder="e.g. INVENT-2026" value={inviteCode} onChange={e => setInviteCode(e.target.value)} /></div>
          </>}
          {error && <div style={{ fontSize: 'clamp(11px,1.3vw,13px)', color: C.red, background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>{error}</div>}
          <button onClick={handleSubmit} disabled={loading} style={{ width: '100%', padding: 'clamp(12px,1.5vw,16px)', fontSize: 'clamp(14px,1.6vw,17px)', fontWeight: 700, background: C.orange, color: '#fff', border: 'none', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .55 : 1, fontFamily: 'inherit' }}>
            {loading ? (tab === 'login' ? 'Signing in…' : 'Creating account…') : (tab === 'login' ? 'Log in' : 'Create account')}
          </button>
        </div>
      </div>
    </div>
  )
}
