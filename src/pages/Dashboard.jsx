import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ChessBoard from '../components/ChessBoard'

export default function Dashboard() {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/login'); return; }
      setUser(session.user)
      loadTournaments(session.user.id)
    })
  }, [])

  const loadTournaments = async (userId) => {
    // Fetch tournaments with player and round counts
    const { data, error } = await supabase
      .from('tournaments')
      .select('*, players(count), rounds(count)')
      .eq('admin_id', userId)
      .order('created_at', { ascending: false })
    if (!error) {
      const enriched = (data || []).map(t => ({
        ...t,
        player_count: t.players?.[0]?.count || 0,
        round_count: t.rounds?.[0]?.count || 0,
      }))
      setTournaments(enriched)
    }
    setLoading(false)
  }

  const createTournament = async () => {
    const { data, error } = await supabase
      .from('tournaments')
      .insert({
        name: 'Nov turnir ' + new Date().toLocaleDateString('sl-SI'),
        admin_id: user.id,
        phase: 'setup',
        notes: '',
      })
      .select()
      .single()
    if (!error && data) {
      navigate(`/tournament/${data.id}`)
    }
  }

  const deleteTournament = async (id) => {
    setDeleting(true)
    const { error } = await supabase.from('tournaments').delete().eq('id', id)
    if (!error) {
      setTournaments(prev => prev.filter(t => t.id !== id))
    }
    setConfirmDeleteId(null)
    setDeleting(false)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="app-wrap">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 0 16px', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <ChessBoard />
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Swiss Chess</h1>
          <div style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>{user?.email}</div>
        </div>
        <button className="btn btn-sm" onClick={signOut}>Odjava</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Moji turnirji</h2>
        <button className="btn btn-primary" onClick={createTournament}>+ Nov turnir</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text2)' }}>
          <span className="spinner"/>
        </div>
      ) : tournaments.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 14 }}>
            Nimate še nobenega turnirja.
          </div>
          <button className="btn btn-primary" onClick={createTournament}>+ Ustvari prvi turnir</button>
        </div>
      ) : (
        <div>
          {tournaments.map(t => (
            <div key={t.id} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{t.name}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 100,
                        fontSize: 12,
                        background: t.phase === 'active' ? 'var(--ok-bg)' : 'var(--surface2)',
                        color: t.phase === 'active' ? 'var(--ok-tx)' : 'var(--text2)',
                        border: `1px solid ${t.phase === 'active' ? 'var(--ok-bd)' : 'var(--border)'}`,
                      }}
                    >
                      {t.phase === 'active' ? 'Aktiven' : 'Priprave'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {t.player_count} {t.player_count === 1 ? 'igralec' : t.player_count < 5 ? 'igralci' : 'igralcev'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {t.round_count} {t.round_count === 1 ? 'krog' : t.round_count < 5 ? 'krogi' : 'krogov'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {formatDate(t.created_at)}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <Link className="btn btn-sm btn-primary" to={`/tournament/${t.id}`}>Odpri</Link>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => setConfirmDeleteId(confirmDeleteId === t.id ? null : t.id)}
                  >
                    Izbriši
                  </button>
                </div>
              </div>

              {confirmDeleteId === t.id && (
                <div style={{
                  marginTop: 10,
                  padding: '10px 12px',
                  background: 'var(--err-bg)',
                  border: '1px solid var(--err-bd)',
                  borderRadius: 'var(--r)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  fontSize: 13,
                  color: 'var(--err-tx)',
                }}>
                  <span>Ste prepričani? Turnir <strong>{t.name}</strong> bo trajno izbrisan skupaj z vsemi podatki.</span>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => deleteTournament(t.id)}
                      disabled={deleting}
                    >
                      {deleting ? 'Brišem…' : 'Da, izbriši'}
                    </button>
                    <button className="btn btn-sm" onClick={() => setConfirmDeleteId(null)}>Prekliči</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
