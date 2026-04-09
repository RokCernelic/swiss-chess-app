import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import TabBar from '../components/TabBar'
import SettingsTab from '../components/tabs/SettingsTab'
import RoundTab from '../components/tabs/RoundTab'
import StandingsTab from '../components/tabs/StandingsTab'
import UnplayedTab from '../components/tabs/UnplayedTab'
import CustomRoundTab from '../components/tabs/CustomRoundTab'

export default function TournamentPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [tournament, setTournament] = useState(null)
  const [players, setPlayers] = useState([])
  const [rounds, setRounds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('settings')
  const [isAdmin, setIsAdmin] = useState(false)
  const [userId, setUserId] = useState(null)

  // Load all data
  const loadData = useCallback(async () => {
    const [
      { data: t, error: te },
      { data: ps, error: pe },
      { data: rs, error: re },
      { data: pairs, error: pae }
    ] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).single(),
      supabase.from('players').select('*').eq('tournament_id', id).order('seed'),
      supabase.from('rounds').select('*').eq('tournament_id', id).order('round_number'),
      supabase.from('pairings').select('*').in(
        'round_id',
        (await supabase.from('rounds').select('id').eq('tournament_id', id)).data?.map(r => r.id) || []
      ).order('board_number'),
    ])

    if (te) { setError('Turnir ni najden.'); setLoading(false); return; }

    const roundsWithPairings = (rs || []).map(r => ({
      ...r,
      pairings: (pairs || []).filter(p => p.round_id === r.id)
    }))

    setTournament(t)
    setPlayers(ps || [])
    setRounds(roundsWithPairings)
    setLoading(false)
  }, [id])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/login'); return; }
      setUserId(session.user.id)
      loadData()
    })
  }, [id])

  // Check admin after tournament loads
  useEffect(() => {
    if (tournament && userId) {
      setIsAdmin(tournament.admin_id === userId)
    }
  }, [tournament, userId])

  // Set default tab when data loads
  useEffect(() => {
    if (!loading && tournament) {
      if (tournament.phase === 'active' && rounds.length > 0) {
        setActiveTab(`round-${rounds[rounds.length - 1].id}`)
      } else {
        setActiveTab('settings')
      }
    }
  }, [loading])

  // Realtime subscriptions
  useEffect(() => {
    if (!id) return

    const pairSub = supabase
      .channel(`pairings-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pairings' }, (payload) => {
        const { eventType, new: newRow, old: oldRow } = payload
        setRounds(prev => prev.map(r => {
          const hasPairing = r.pairings.some(p =>
            eventType === 'INSERT' ? p.round_id === newRow?.round_id : p.id === (newRow?.id || oldRow?.id)
          )
          if (!hasPairing && eventType !== 'INSERT') return r
          if (eventType === 'INSERT' && newRow?.round_id !== r.id) return r
          if (eventType === 'UPDATE') {
            return { ...r, pairings: r.pairings.map(p => p.id === newRow.id ? { ...p, ...newRow } : p) }
          }
          if (eventType === 'DELETE') {
            return { ...r, pairings: r.pairings.filter(p => p.id !== oldRow.id) }
          }
          if (eventType === 'INSERT' && newRow?.round_id === r.id) {
            return { ...r, pairings: [...r.pairings, newRow] }
          }
          return r
        }))
      })
      .subscribe()

    const tournSub = supabase
      .channel(`tournament-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` }, (payload) => {
        setTournament(prev => ({ ...prev, ...payload.new }))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(pairSub)
      supabase.removeChannel(tournSub)
    }
  }, [id])

  // Handlers
  const handleResultChange = (roundId, pairingId, result) => {
    setRounds(prev => prev.map(r =>
      r.id === roundId
        ? { ...r, pairings: r.pairings.map(p => p.id === pairingId ? { ...p, result } : p) }
        : r
    ))
  }

  const handleDeleteRound = async (roundId) => {
    const deletedRound = rounds.find(r => r.id === roundId)
    const newRounds = rounds.filter(r => r.id !== roundId)
    setRounds(newRounds)

    // If we deleted round 1 and there are no more rounds, reset phase
    if (deletedRound?.round_number === 1 && newRounds.length === 0) {
      await supabase.from('tournaments').update({ phase: 'setup' }).eq('id', id)
      setTournament(prev => ({ ...prev, phase: 'setup' }))
    }

    // Switch to last remaining round or settings
    if (newRounds.length > 0) {
      setActiveTab(`round-${newRounds[newRounds.length - 1].id}`)
    } else {
      setActiveTab('settings')
    }
  }

  const handleNewRound = (roundObj, replaceId = null) => {
    if (replaceId) {
      setRounds(prev => prev.map(r => r.id === replaceId ? roundObj : r))
    } else {
      // Check if round_number already exists (custom overwrite scenario by round_number)
      setRounds(prev => {
        const exists = prev.find(r => r.round_number === roundObj.round_number)
        if (exists) {
          return prev.map(r => r.round_number === roundObj.round_number ? roundObj : r)
        }
        return [...prev, roundObj].sort((a, b) => a.round_number - b.round_number)
      })
    }
  }

  const handleFinish = () => setActiveTab('standings')

  const handleNewTournament = () => navigate('/dashboard')

  // Build tabs
  const buildTabs = () => {
    const tabs = []

    if (tournament?.phase === 'setup' || isAdmin) {
      tabs.push({ id: 'settings', label: 'Nastavitve' })
    }

    rounds.forEach((r) => {
      const hasPending = r.pairings.some(p => !p.is_bye && !p.result)
      tabs.push({
        id: `round-${r.id}`,
        label: `Krog ${r.round_number}`,
        dot: hasPending,
      })
    })

    if (rounds.length > 0) {
      // Unplayed dot: unplayed from past rounds
      const pastRounds = rounds.slice(0, -1)
      const hasUnplayed = pastRounds.some(r => r.pairings.some(p => !p.is_bye && !p.result))
      tabs.push({ id: 'unplayed', label: 'Neigrane', dot: hasUnplayed })
      tabs.push({ id: 'standings', label: 'Razvrstitev' })
      if (isAdmin) tabs.push({ id: 'custom', label: 'Ročna runda' })
    }

    return tabs
  }

  if (loading) {
    return (
      <div className="app-wrap" style={{ textAlign: 'center', padding: 60 }}>
        <span className="spinner"/>
        <div style={{ color: 'var(--text2)', marginTop: 12, fontSize: 14 }}>Nalagam turnir…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app-wrap">
        <div className="notice notice-err" style={{ marginTop: 32 }}>{error}</div>
        <Link className="btn" to="/dashboard" style={{ marginTop: 12, display: 'inline-flex' }}>← Nazaj</Link>
      </div>
    )
  }

  const tabs = buildTabs()
  const unplayedPastCount = rounds.slice(0, -1).reduce((acc, r) =>
    acc + r.pairings.filter(p => !p.is_bye && !p.result).length, 0
  )

  return (
    <div className="app-wrap">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 }}>
        <Link
          className="btn btn-sm"
          to="/dashboard"
          style={{ color: 'var(--text2)', fontSize: 12 }}
        >← Dashboard</Link>
        <a
          href={`/t/${id}`}
          target="_blank"
          rel="noreferrer"
          className="btn btn-sm"
          style={{ fontSize: 12, color: 'var(--info-tx)' }}
        >🔗 Javni pogled</a>
      </div>

      <Header
        tournament={tournament}
        players={players}
        rounds={rounds}
        onTournamentUpdate={setTournament}
        isAdmin={isAdmin}
        isPublic={false}
      />

      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === 'settings' && (
        <SettingsTab
          tournament={tournament}
          players={players}
          rounds={rounds}
          onPlayersChange={setPlayers}
          onTournamentUpdate={setTournament}
          onRoundsChange={setRounds}
          onTabChange={setActiveTab}
        />
      )}

      {rounds.map((round, idx) =>
        activeTab === `round-${round.id}` ? (
          <RoundTab
            key={round.id}
            round={round}
            roundIndex={idx}
            allRounds={rounds}
            players={players}
            tournament={tournament}
            isAdmin={isAdmin}
            onResultChange={handleResultChange}
            onDeleteRound={handleDeleteRound}
            onNewRound={handleNewRound}
            onTabChange={setActiveTab}
            onFinish={handleFinish}
          />
        ) : null
      )}

      {activeTab === 'unplayed' && (
        <UnplayedTab
          rounds={rounds}
          players={players}
          isAdmin={isAdmin}
          onResultChange={handleResultChange}
        />
      )}

      {activeTab === 'standings' && (
        <StandingsTab
          tournament={tournament}
          players={players}
          rounds={rounds}
          isAdmin={isAdmin}
          onTabChange={setActiveTab}
          onNewRound={handleNewRound}
          onNewTournament={handleNewTournament}
        />
      )}

      {activeTab === 'custom' && isAdmin && (
        <CustomRoundTab
          tournament={tournament}
          players={players}
          rounds={rounds}
          onNewRound={handleNewRound}
          onTabChange={setActiveTab}
        />
      )}
    </div>
  )
}
