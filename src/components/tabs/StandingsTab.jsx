import { supabase } from '../../lib/supabase'
import { buildStandings, fmtScore, autoMaxRounds } from '../../lib/scoring'
import { genPairings } from '../../lib/swiss'

export default function StandingsTab({
  tournament,
  players,
  rounds,
  isAdmin,
  onTabChange,
  onNewRound,
  onNewTournament,
}) {
  const standings = buildStandings(players, rounds)
  const maxR = tournament?.max_rounds || autoMaxRounds(players.length)
  const isComplete = rounds.length >= maxR && rounds.every(r => r.pairings.every(p => p.is_bye || p.result))
  const hasPending = rounds.some(r => r.pairings.some(p => !p.is_bye && !p.result))

  const generateNextRound = async () => {
    const nextNum = (rounds[rounds.length - 1]?.round_number || 0) + 1
    const { data: newRound, error: re } = await supabase
      .from('rounds')
      .insert({ tournament_id: tournament.id, round_number: nextNum, is_custom: false })
      .select()
      .single()
    if (re) { console.error(re); return; }
    const pairings = genPairings(players, rounds)
    const toInsert = pairings.map(p => ({ ...p, round_id: newRound.id }))
    const { data: insertedPairings, error: pe } = await supabase.from('pairings').insert(toInsert).select()
    if (pe) { console.error(pe); return; }
    const roundObj = { ...newRound, pairings: insertedPairings || [] }
    onNewRound(roundObj)
    onTabChange(`round-${newRound.id}`)
  }

  const getMedalClass = (rank) => {
    if (rank === 0) return 'medal medal-gold'
    if (rank === 1) return 'medal medal-silver'
    if (rank === 2) return 'medal medal-bronze'
    return 'medal medal-plain'
  }

  // Compute ranks with ties
  const ranked = []
  let currentRank = 1
  standings.forEach((p, i) => {
    if (i === 0) {
      ranked.push({ ...p, rank: 1, tied: false })
    } else {
      const prev = standings[i - 1]
      if (p.score === prev.score && p.buchholz === prev.buchholz) {
        ranked.push({ ...p, rank: ranked[i - 1].rank, tied: true })
        ranked[i - 1].tied = true
      } else {
        currentRank = i + 1
        ranked.push({ ...p, rank: currentRank, tied: false })
      }
    }
  })

  return (
    <div>
      {hasPending && (
        <div className="notice notice-warn" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <span className="dot-orange"/>
          Nekatere partije še niso vnesene — razvrstitev je začasna.
        </div>
      )}

      {isComplete && (
        <div className="card" style={{ background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ok-tx)' }}>
                Turnir zaključen ({rounds.length} {rounds.length === 1 ? 'krog' : rounds.length < 5 ? 'krogi' : 'krogov'})
              </div>
              {ranked[0] && (
                <div style={{ fontSize: 14, color: 'var(--ok-tx)', marginTop: 2 }}>
                  🏆 Zmagovalec: <strong>{ranked[0].name}</strong> ({fmtScore(ranked[0].score)} točk)
                </div>
              )}
            </div>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-sm" onClick={() => onTabChange('custom')}>+ Dodaj rundo</button>
              <button className="btn btn-sm btn-primary" onClick={onNewTournament}>Nov turnir</button>
            </div>
          )}
        </div>
      )}

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Igralec</th>
              <th style={{ textAlign: 'right' }}>Točke</th>
              <th style={{ textAlign: 'right' }}>Buchholz</th>
              <th style={{ textAlign: 'right' }}>ELO</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p, i) => (
              <tr key={p.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className={getMedalClass(i)}>
                      {p.rank}
                    </span>
                    {p.tied && <span style={{ fontSize: 10, color: 'var(--text3)' }}>d</span>}
                  </div>
                </td>
                <td style={{ fontWeight: i < 3 ? 600 : 400 }}>
                  {p.name}
                  {p.tied && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>deljeno</span>}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, fontSize: 14 }}>
                  {fmtScore(p.score)}
                </td>
                <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--text2)', fontFamily: 'monospace' }}>
                  {fmtScore(p.buchholz)}
                </td>
                <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--text2)' }}>
                  {p.rating || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdmin && !isComplete && (
        <div className="action-row">
          <button className="btn btn-sm" onClick={() => onTabChange('custom')}>
            + Uvozi ročno rundo
          </button>
          {rounds.length < maxR && rounds.length > 0 && !hasPending && (
            <button className="btn btn-primary btn-sm" onClick={generateNextRound}>
              Žrebaj krog {(rounds[rounds.length - 1]?.round_number || 0) + 1} →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
