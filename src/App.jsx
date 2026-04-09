import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase, isConfigured } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import TournamentPage from './pages/TournamentPage'
import PublicView from './pages/PublicView'

function RequireAuth({ children }) {
  const [status, setStatus] = useState(isConfigured ? 'loading' : 'unauthed')

  useEffect(() => {
    if (!isConfigured) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus(session ? 'authed' : 'unauthed')
    }).catch(() => setStatus('unauthed'))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setStatus(session ? 'authed' : 'unauthed')
    })
    return () => subscription.unsubscribe()
  }, [])

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <span className="spinner"/>
      </div>
    )
  }

  if (status === 'unauthed') {
    return <Navigate to="/login" replace />
  }

  return children
}

function RootRedirect() {
  const [status, setStatus] = useState(isConfigured ? 'loading' : 'unauthed')

  useEffect(() => {
    if (!isConfigured) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus(session ? 'authed' : 'unauthed')
    }).catch(() => setStatus('unauthed'))
  }, [])

  if (status === 'loading') return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <span className="spinner"/>
    </div>
  )
  return <Navigate to={status === 'authed' ? '/dashboard' : '/login'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={
          <RequireAuth><Dashboard /></RequireAuth>
        } />
        <Route path="/tournament/:id" element={
          <RequireAuth><TournamentPage /></RequireAuth>
        } />
        <Route path="/t/:id" element={<PublicView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
