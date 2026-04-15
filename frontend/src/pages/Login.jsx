import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, signup } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'parent', invite_code: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { loginUser } = useAuth()
  const navigate = useNavigate()

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await login(form.email, form.password)
      loginUser(data.access_token)
      const payload = JSON.parse(atob(data.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      if (payload.role === 'parent') navigate('/parent')
      else if (payload.role === 'teacher') navigate('/teacher')
      else if (payload.role === 'admin') navigate('/admin')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    }
    setLoading(false)
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await signup(form.name, form.email, form.password, form.role, form.invite_code)
      loginUser(data.access_token)
      if (form.role === 'parent') navigate('/parent')
      else if (form.role === 'teacher') navigate('/teacher')
      else if (form.role === 'admin') navigate('/admin')
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'#FFF8F3'}}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{border:'1px solid #F4C099'}}>
        <div className="p-4 text-center" style={{background:'#F47920'}}>
          <div className="text-base font-bold text-white">PTM Scheduler</div>
          <div className="text-xs mt-1" style={{color:'#FFE0C0'}}>Inventure Academy · Parent-Teacher Meetings</div>
        </div>

        <div className="flex" style={{borderBottom:'1px solid #F4C099'}}>
          {['login','signup'].map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className="flex-1 py-2.5 text-xs font-semibold transition-all"
              style={{
                color: tab===t ? '#F47920' : '#9CA3AF',
                borderBottom: tab===t ? '2px solid #F47920' : '2px solid transparent',
                background: tab===t ? '#FFF8F3' : '#fff'
              }}>
              {t==='login' ? 'Log in' : 'Sign up'}
            </button>
          ))}
        </div>

        <form onSubmit={tab==='login' ? handleLogin : handleSignup}
          className="p-4 flex flex-col gap-3" style={{background:'#fff'}}>
          {tab==='signup' && (
            <div>
              <label className="block text-xs font-semibold mb-1" style={{color:'#1B3F7A'}}>Full name</label>
              <input name="name" value={form.name} onChange={update} placeholder="Paras Mehta"
                className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                style={{border:'1px solid #F4C099'}}
                onFocus={e=>e.target.style.borderColor='#F47920'}
                onBlur={e=>e.target.style.borderColor='#F4C099'} />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{color:'#1B3F7A'}}>Email</label>
            <input name="email" value={form.email} onChange={update} placeholder="you@example.com" type="email"
              className="w-full px-3 py-2 text-xs rounded-lg outline-none"
              style={{border:'1px solid #F4C099'}}
              onFocus={e=>e.target.style.borderColor='#F47920'}
              onBlur={e=>e.target.style.borderColor='#F4C099'} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{color:'#1B3F7A'}}>Password</label>
            <input name="password" value={form.password} onChange={update} placeholder="Min. 8 characters" type="password"
              className="w-full px-3 py-2 text-xs rounded-lg outline-none"
              style={{border:'1px solid #F4C099'}}
              onFocus={e=>e.target.style.borderColor='#F47920'}
              onBlur={e=>e.target.style.borderColor='#F4C099'} />
          </div>

          {tab==='signup' && (
            <>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{color:'#1B3F7A'}}>I am a</label>
                <div className="flex gap-2">
                  {['parent','teacher','admin'].map(r=>(
                    <button type="button" key={r} onClick={()=>setForm({...form,role:r})}
                      className="flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all"
                      style={{
                        background: form.role===r ? '#FFF0E6' : '#fff',
                        border: form.role===r ? '1px solid #F47920' : '1px solid #F4C099',
                        color: form.role===r ? '#C45A0A' : '#9CA3AF'
                      }}>
                      {r.charAt(0).toUpperCase()+r.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-lg p-3" style={{background:'#FFF0E6',border:'1px solid #F4C099'}}>
                <div className="text-xs font-bold mb-1" style={{color:'#C45A0A'}}>School invite code</div>
                <input name="invite_code" value={form.invite_code} onChange={update} placeholder="e.g. INVENT-2026"
                  className="w-full bg-transparent text-sm font-bold outline-none tracking-wider"
                  style={{color:'#1B3F7A',border:'none'}} />
              </div>
            </>
          )}

          {error && <div className="text-xs" style={{color:'#E24B4A'}}>{error}</div>}

          <button type="submit" disabled={loading}
            className="w-full py-2 text-sm font-bold rounded-lg mt-1 disabled:opacity-50"
            style={{background:'#F47920',color:'#fff',border:'none'}}>
            {loading ? 'Please wait...' : tab==='login' ? 'Log in' : 'Create account'}
          </button>

          <div className="text-center text-xs" style={{color:'#9CA3AF'}}>
            {tab==='login' ? (
              <>Don't have an account? <span className="font-semibold cursor-pointer" style={{color:'#F47920'}} onClick={()=>setTab('signup')}>Sign up</span></>
            ) : (
              <>Already have an account? <span className="font-semibold cursor-pointer" style={{color:'#F47920'}} onClick={()=>setTab('login')}>Log in</span></>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
