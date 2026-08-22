import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { requestOtp, verifyOtp, adminLogin } from '../api/auth'
import { LOGO_LARGE } from '../assets/logos'

// Frontend-only easter egg. Pure client-side: never calls the backend, never
// creates a session. Requires the exact email + an exact (case-sensitive) code.
// Add a game by dropping another `code: url` pair in here — any code length works.
// Demo email is public (not a secret); only the code (DEMO_SECRET_CODE) is, and
// that's checked server-side. Routing this email to the code step lets the demo
// admin type the secret code — request-otp would otherwise reject an admin email.
const DEMO_EMAIL = 'demo@inventureacademy.com'
const EGG_EMAIL = 'alphamogger@pm4k.com'
const EGG_GAMES = {
  pmmxgu: 'https://vex5.gitlab.io/file/',
  basketrandom: 'https://script.google.com/macros/s/AKfycbwiQgeRHVDP8wzJ_CeSE1LyaKCMu1qdlopwylhD4LdBvBVd2y36VjlWY0iyk38WH0JiJA/exec',
  dunedash: 'https://script.google.com/macros/s/AKfycbxif2sgdRNG-zqSFKUNZ60ZABnsdBYug037DeKlnuXY1XYyveJlFQK6YHpCX-KiWnC6/exec',
  rugby: 'https://script.google.com/macros/s/AKfycbxjYzXDX0iopyVPSDgG8_sTlQPpjv5KYMdsOtLXzYrQYdHPmHdswUb5NTXedQ3RK8XyoQ/exec',
  basketbros: 'https://script.google.com/macros/s/AKfycbxUfaDSpH-0SJL0WPKt38JY7OOOGMmtpY9JTSbL8pvtjxS7jSpNHHu6MdZgWUshIU00Kw/exec',
  slope: 'https://slope-unblocked.gitlab.io/file/',
  subwaysurfers: 'https://gertdoro.github.io/3hg7dj3bnc82/index.html',
}
const EGG_CODES = Object.keys(EGG_GAMES)
const EGG_MAX_LEN = Math.max(...EGG_CODES.map(c => c.length))
// own-property lookup only (so "constructor" etc. can't match)
const eggUrlFor = code => (Object.prototype.hasOwnProperty.call(EGG_GAMES, code) ? EGG_GAMES[code] : null)

// Phone-portrait breakpoint. Desktop/tablet (>640px) keeps the original layout
// untouched; only <=640px opts into the mobile-specific styles below.
function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const on = e => setM(e.matches)
    mq.addEventListener('change', on)
    setM(mq.matches)
    return () => mq.removeEventListener('change', on)
  }, [])
  return m
}

export default function Login({ branded = false } = {}) {
  const { loginUser } = useAuth()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)        // 1 = email/(password), 2 = OTP
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [digits, setDigits] = useState(() => Array(6).fill(''))
  const [shake, setShake] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)  // reveal password field for admins
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [egg, setEgg] = useState(null)       // easter-egg game URL (null = off)
  const inputsRef = useRef([])
  const eggKeys = useRef('')                 // raw keystroke buffer (OTP UI strips non-digits)

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
    // Easter egg: advance to the code step looking exactly normal — no backend call.
    if (email === EGG_EMAIL) { setStep(2); return }
    // Demo login: skip request-otp (admin emails are rejected there) and go straight
    // to code entry; the typed code is checked against DEMO_SECRET_CODE in verify-otp.
    if (email === DEMO_EMAIL) { setStep(2); return }
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

  const submitOtp = async (codeStr) => {
    setError('')
    setLoading(true)
    try {
      const data = await verifyOtp(email, codeStr)
      redirectByRole(data.access_token)  // navigates away on success
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired code.')
      setShake(true)
      setTimeout(() => setShake(false), 450)
      setDigits(Array(6).fill(''))
      setLoading(false)
      setTimeout(() => inputsRef.current[0]?.focus(), 0)
    }
  }

  const handleDigit = (i, raw) => {
    // Easter egg: capture raw keystrokes into a rolling buffer (runs before OTP
    // logic). For the egg email we never fill boxes/submit — the buffer alone
    // drives it, so codes longer than 6 chars still work.
    if (email === EGG_EMAIL) {
      eggKeys.current = (eggKeys.current + raw.slice(-1)).slice(-EGG_MAX_LEN)
      const hit = EGG_CODES.find(code => eggKeys.current.endsWith(code))
      if (hit) { setEgg(EGG_GAMES[hit]); return }
      return
    }
    // Alphanumeric, 6 chars — letters are needed for the demo login code.
    const d = raw.replace(/[^a-zA-Z0-9]/g, '')
    const n = [...digits]
    if (!d) { n[i] = ''; setDigits(n); return }
    n[i] = d[d.length - 1]
    setDigits(n)
    if (i < 5) inputsRef.current[i + 1]?.focus()
    if (!n.includes('')) submitOtp(n.join(''))
  }

  const handleOtpKey = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const n = [...digits]
      if (n[i]) { n[i] = ''; setDigits(n) }
      else if (i > 0) { n[i - 1] = ''; setDigits(n); inputsRef.current[i - 1]?.focus() }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      inputsRef.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < 5) {
      inputsRef.current[i + 1]?.focus()
    }
  }

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text') || ''
    if (email === EGG_EMAIL && eggUrlFor(pasted)) { e.preventDefault(); setEgg(eggUrlFor(pasted)); return }
    const txt = pasted.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6)
    if (!txt) return
    e.preventDefault()
    const n = Array(6).fill('')
    for (let k = 0; k < txt.length; k++) n[k] = txt[k]
    setDigits(n)
    inputsRef.current[txt.length >= 6 ? 5 : txt.length]?.focus()
    if (txt.length === 6) submitOtp(txt)
  }

  const backToEmail = () => { setStep(1); setDigits(Array(6).fill('')); setError(''); setShake(false); eggKeys.current = '' }

  const onKey = e => { if (e.key === 'Enter') handleSendOtp() }

  useEffect(() => {
    if (!document.getElementById('otp-shake-style')) {
      const s = document.createElement('style')
      s.id = 'otp-shake-style'
      s.textContent = '@keyframes otp-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}'
      document.head.appendChild(s)
    }
  }, [])
  useEffect(() => { if (step === 2) { eggKeys.current = ''; setTimeout(() => inputsRef.current[0]?.focus(), 0) } }, [step])
  // Easter-egg exit: Escape closes the game (the × button is the reliable exit once
  // focus is inside the cross-origin iframe).
  useEffect(() => {
    if (!egg) return
    const onKeyDown = e => { if (e.key === 'Escape') setEgg(null) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [egg])

  const inp = { width: '100%', padding: 'clamp(10px,1.3vw,14px) clamp(12px,1.6vw,16px)', fontSize: 'clamp(13px,1.5vw,15px)', border: '1.5px solid #F4C099', borderRadius: 10, outline: 'none', fontFamily: 'inherit', transition: 'border-color .15s, box-shadow .15s', color: '#1B3F7A', background: '#fff', boxSizing: 'border-box' }
  const focusOn = e => { e.target.style.borderColor = '#F47920'; e.target.style.boxShadow = '0 0 0 3px rgba(244,121,32,.12)' }
  const focusOff = e => { e.target.style.borderColor = '#F4C099'; e.target.style.boxShadow = 'none' }
  const label = { fontSize: 'clamp(11px,1.3vw,13px)', fontWeight: 600, color: '#1B3F7A', display: 'block', marginBottom: 'clamp(4px,.5vw,7px)' }

  if (egg) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: '#000' }}>
        <iframe
          title="game"
          src={egg}
          allow="fullscreen; autoplay; gamepad; accelerometer"
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />
        <button
          onClick={() => setEgg(null)}
          aria-label="Exit"
          title="Exit (Esc)"
          style={{ position: 'fixed', top: 8, right: 10, zIndex: 100000, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.4)', color: 'rgba(255,255,255,.55)', fontSize: 17, lineHeight: '28px', textAlign: 'center', padding: 0, cursor: 'pointer' }}
        >×</button>
      </div>
    )
  }

  // PTM Now brand header — matches the public landing site. Links go to the
  // landing pages (served at the domain root, separate from the app routes).
  const navLink = { color: '#4A524D', textDecoration: 'none', fontSize: isMobile ? 13 : 'clamp(13px,1.5vw,15px)', whiteSpace: 'nowrap' }

  return (
    <div style={{ minHeight: isMobile ? '100svh' : '100vh', background: '#FFF8F3', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,sans-serif' }}>

      {/* Branded login pages have a bare header — no icon, wordmark, or nav links. */}
      {branded ? null : (
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: isMobile ? '0 14px' : '0 clamp(16px,3vw,32px)', height: 'clamp(54px,7vw,64px)', background: '#fff', borderBottom: '0.5px solid #E9E4DC', flexShrink: 0 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 7 : 10, minWidth: 0, textDecoration: 'none', color: '#1F2421', fontWeight: 600, fontSize: isMobile ? 16 : 'clamp(16px,2vw,18px)' }}>
          <svg width="30" height="30" viewBox="0 0 170 170" aria-hidden="true" style={{ flexShrink: 0 }}>
            <rect x="10" y="24" width="150" height="140" rx="26" fill="#EE5A52" />
            <rect x="36" y="10" width="16" height="34" rx="8" fill="#C6362E" />
            <rect x="118" y="10" width="16" height="34" rx="8" fill="#C6362E" />
            <rect x="10" y="24" width="150" height="34" rx="26" fill="#D8443B" />
            <rect x="10" y="44" width="150" height="14" fill="#D8443B" />
            <path d="M54 106 L76 130 L118 78" fill="none" stroke="#fff" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          PTM Now
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 14 : 'clamp(16px,2.5vw,28px)', flexShrink: 0 }}>
          <a href="/how-it-works" style={navLink}>How it works</a>
          <a href="/privacy" style={navLink}>Privacy</a>
        </div>
      </nav>
      )}

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '16px' : 'clamp(10px,2vw,28px)', boxSizing: 'border-box' }}>
        <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', width: '100%', maxWidth: isMobile ? '400px' : 'clamp(320px,36vw,460px)', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>

          <div style={{ padding: isMobile ? '18px 20px' : 'clamp(14px,2vw,26px) clamp(16px,2.5vw,32px)', background: '#F47920', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? 6 : 'clamp(4px,.6vw,8px)' }}>
            <img src={LOGO_LARGE} alt="Inventure Academy" style={{ height: isMobile ? 42 : 'clamp(38px,5vw,56px)', width: 'auto', display: 'block', filter: 'brightness(0) invert(1)' }} />
            {branded ? (
              // Subtle credit line — reads as an attribution, not a second brand.
              // Solid (not translucent) dark brown: translucent white on this
              // orange tops out at ~2.8:1 even at full opacity, which fails WCAG
              // AA (4.5:1) for small text. #5A2400 hits 4.51:1 while staying
              // small/unbold, per the "subtle, not a second brand" brief.
              <div style={{ fontSize: 'clamp(11px,1.3vw,13px)', color: '#5A2400', fontWeight: 500, letterSpacing: '.02em', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, flexWrap: 'wrap' }}>
                PTM Scheduler
                <span aria-hidden="true">·</span>
                Powered by
                <svg width="14" height="14" viewBox="0 0 170 170" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <rect x="10" y="24" width="150" height="140" rx="26" fill="#EE5A52" />
                  <rect x="36" y="10" width="16" height="34" rx="8" fill="#C6362E" />
                  <rect x="118" y="10" width="16" height="34" rx="8" fill="#C6362E" />
                  <rect x="10" y="24" width="150" height="34" rx="26" fill="#D8443B" />
                  <rect x="10" y="44" width="150" height="14" fill="#D8443B" />
                  <path d="M54 106 L76 130 L118 78" fill="none" stroke="#fff" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <a href="/" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 500 }}>PTM Now</a>
              </div>
            ) : (
              <div style={{ fontSize: 'clamp(12px,1.4vw,15px)', color: 'rgba(255,255,255,.9)', fontWeight: 600, letterSpacing: '.02em' }}>PTM Scheduler</div>
            )}
          </div>

          <div style={{ padding: isMobile ? '20px' : 'clamp(16px,2.2vw,28px) clamp(20px,2.8vw,36px)', display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 'clamp(12px,1.6vw,20px)' }}>

            {step === 1 ? (<>
              <div style={{ fontSize: 'clamp(16px,2vw,22px)', fontWeight: 700, color: '#1B3F7A', letterSpacing: '-.02em', lineHeight: 1.15 }}>Sign in to your account</div>

              <div>
                <label style={label}>Email</label>
                <input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={onKey}
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
            </>) : (<>
              <div style={{ fontSize: 'clamp(16px,2vw,22px)', fontWeight: 700, color: '#1B3F7A', letterSpacing: '-.02em', lineHeight: 1.15 }}>Enter your code</div>
              <div style={{ fontSize: 'clamp(12px,1.4vw,15px)', color: '#6B7280', marginTop: -8 }}>Enter the 6-digit code sent to <span style={{ color: '#1B3F7A', fontWeight: 600 }}>{email}</span></div>

              <div style={{ display: 'flex', gap: isMobile ? 8 : 'clamp(6px,1.5vw,10px)', justifyContent: 'space-between', minWidth: 0, maxWidth: '100%', animation: shake ? 'otp-shake .45s' : 'none', opacity: loading ? .6 : 1 }}>
                {digits.map((dgt, i) => (
                  <input
                    key={i}
                    ref={el => { inputsRef.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    size={1}
                    value={dgt}
                    disabled={loading}
                    onChange={e => handleDigit(i, e.target.value)}
                    onKeyDown={e => handleOtpKey(i, e)}
                    onPaste={handleOtpPaste}
                    onFocus={e => { e.target.select(); e.target.style.boxShadow = '0 0 0 3px rgba(244,121,32,.2)' }}
                    onBlur={e => { e.target.style.boxShadow = 'none' }}
                    style={{
                      // Width is ALWAYS flex-shrinkable so the six boxes divide the row's inner
                      // width and can never exceed it — no fixed px that could overflow a narrow
                      // screen, regardless of breakpoint. maxWidth caps each at the original 52px,
                      // so on a wide desktop row (with space-between) the layout is identical to the
                      // previous fixed-52px boxes. Only height/font shrink slightly on mobile.
                      flex: '1 1 0', minWidth: 0, maxWidth: 52,
                      WebkitAppearance: 'none', appearance: 'none',
                      height: isMobile ? 48 : 'clamp(46px,14vw,56px)',
                      textAlign: 'center',
                      fontSize: isMobile ? 22 : 'clamp(20px,5vw,26px)', fontWeight: 700, color: '#1B3F7A',
                      border: `2px solid ${shake ? '#DC2626' : '#F4C099'}`, borderRadius: 12, outline: 'none',
                      background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box', padding: 0,
                      transition: 'border-color .15s, box-shadow .15s',
                    }}
                  />
                ))}
              </div>

              {error && <div style={{ fontSize: 'clamp(11px,1.3vw,13px)', color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>{error}</div>}

              <button onClick={backToEmail} aria-label="Back to email"
                style={isMobile
                  ? { alignSelf: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, padding: '10px 20px', background: '#FFF8F3', border: '1.5px solid #F4C099', borderRadius: 22, color: '#C45A0A', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
                  : { background: 'none', border: 'none', color: '#C45A0A', fontSize: 'clamp(12px,1.4vw,15px)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center' }}>← Back</button>
            </>)}

          </div>
        </div>
      </div>
    </div>
  )
}
