import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import TabBar from '../components/TabBar'
import RoundTab from '../components/tabs/RoundTab'
import StandingsTab from '../components/tabs/StandingsTab'
import UnplayedTab from '../components/tabs/UnplayedTab'
import { fmtScore } from '../lib/swiss'

export default function PublicView() {
  const { id } = useParams()
  const [tournament, setTournament] = useState(null)
  const [players, setPlayers] = useState([])
  const [rounds, setRounds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('standings')

  const loadData = useCallback(async () => {
    const [
      { data: t, error: te },
      { data: ps },
      { data: rs },
    ] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).single(),
      supabase.from('players').select('*').eq('tournament_id', id).order('seed'),
      supabase.from('rounds').select('*').eq('tournament_id', id).order('round_number'),
    ])

    if (te || !t) { setError('Turnir ni najden.'); setLoading(false); return; }

    const roundIds = (rs || []).map(r => r.id)
    let pairs = []
    if (roundIds.length > 0) {
      const { data: p } = await supabase
        .from('pairings')
        .select('*')
        .in('round_id', roundIds)
        .order('board_number')
      pairs = p || []
    }

    const roundsWithPairings = (rs || []).map(r => ({
      ...r,
      pairings: pairs.filter(p => p.round_id === r.id)
    }))

    setTournament(t)
    setPlayers(ps || [])
    setRounds(roundsWithPairings)
    setLoading(false)

    // Default tab: last round if active, otherwise standings
    if (t.phase === 'active' && roundsWithPairings.length > 0) {
      setActiveTab(`round-${roundsWithPairings[roundsWithPairings.length - 1].id}`)
    } else {
      setActiveTab('standings')
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [id])

  // Realtime
  useEffect(() => {
    if (!id) return

    const pairSub = supabase
      .channel(`pub-pairings-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pairings' }, (payload) => {
        const { eventType, new: newRow, old: oldRow } = payload
        setRounds(prev => prev.map(r => {
          if (eventType === 'UPDATE' && r.pairings.some(p => p.id === newRow.id)) {
            return { ...r, pairings: r.pairings.map(p => p.id === newRow.id ? { ...p, ...newRow } : p) }
          }
          if (eventType === 'INSERT' && newRow?.round_id === r.id) {
            return { ...r, pairings: [...r.pairings, newRow] }
          }
          return r
        }))
      })
      .subscribe()

    const tournSub = supabase
      .channel(`pub-tournament-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` }, (payload) => {
        setTournament(prev => ({ ...prev, ...payload.new }))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(pairSub)
      supabase.removeChannel(tournSub)
    }
  }, [id])

  const buildTabs = () => {
    const tabs = []
    rounds.forEach((r) => {
      const hasPending = r.pairings.some(p => !p.is_bye && !p.result)
      tabs.push({ id: `round-${r.id}`, label: `Krog ${r.round_number}`, dot: hasPending })
    })
    if (rounds.length > 0) {
      const pastRounds = rounds.slice(0, -1)
      const hasUnplayed = pastRounds.some(r => r.pairings.some(p => !p.is_bye && !p.result))
      tabs.push({ id: 'unplayed', label: 'Neigrane', dot: hasUnplayed })
      tabs.push({ id: 'standings', label: 'Razvrstitev' })
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
      </div>
    )
  }

  const tabs = buildTabs()

  return (
    <div className="app-wrap">
      <Header
        tournament={tournament}
        players={players}
        rounds={rounds}
        onTournamentUpdate={setTournament}
        isAdmin={false}
        isPublic={true}
      />

      {tabs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text2)' }}>
          Turnir še ni začet.
        </div>
      ) : (
        <>
          <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

          {rounds.map((round, idx) =>
            activeTab === `round-${round.id}` ? (
              <RoundTab
                key={round.id}
                round={round}
                roundIndex={idx}
                allRounds={rounds}
                players={players}
                tournament={tournament}
                isAdmin={false}
                onResultChange={() => {}}
                onDeleteRound={() => {}}
                onNewRound={() => {}}
                onTabChange={setActiveTab}
                onFinish={() => setActiveTab('standings')}
              />
            ) : null
          )}

          {activeTab === 'unplayed' && (
            <UnplayedTab
              rounds={rounds}
              players={players}
              isAdmin={false}
              onResultChange={() => {}}
            />
          )}

          {activeTab === 'standings' && (
            <StandingsTab
              tournament={tournament}
              players={players}
              rounds={rounds}
              isAdmin={false}
              onTabChange={setActiveTab}
              onNewRound={() => {}}
              onNewTournament={() => {}}
            />
          )}
        </>
      )}
    </div>
  )
}
