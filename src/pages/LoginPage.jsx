import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ChessBoard from '../components/ChessBoard'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        navigate('/dashboard')
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setSuccess('Registracija uspešna! Preverite e-pošto za potrditev, nato se prijavite.')
        setMode('login')
      }
    }
    setLoading(false)
  }

  return (
    <div className="login-wrap">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <ChessBoard />
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Swiss Chess</h1>
          <div style={{ color: 'var(--text2)', fontSize: 14, marginTop: 2 }}>Upravljanje šahovskih turnirjev</div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>
          {mode === 'login' ? 'Prijava' : 'Registracija'}
        </h2>

        {error && <div className="notice notice-err" style={{ marginBottom: 12 }}>{error}</div>}
        {success && <div className="notice notice-ok" style={{ marginBottom: 12 }}>{success}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
              E-pošta
            </label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="vas@email.com"
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
              Geslo
            </label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              minLength={6}
            />
          </div>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '9px 0' }}
          >
            {loading ? (mode === 'login' ? 'Prijavljam…' : 'Registriram…') : (mode === 'login' ? 'Prijava' : 'Registracija')}
          </button>
        </form>

        <div style={{ marginTop: 14, textAlign: 'center', fontSize: 13, color: 'var(--text2)' }}>
          {mode === 'login' ? (
            <>Nimate računa?{' '}
              <button
                style={{ background: 'none', border: 'none', color: 'var(--info-tx)', cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}
                onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
              >Registrirajte se</button>
            </>
          ) : (
            <>Že imate račun?{' '}
              <button
                style={{ background: 'none', border: 'none', color: 'var(--info-tx)', cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              >Prijavite se</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
