import { supabase } from '../../lib/supabase'
import { calcScores, fmtScore } from '../../lib/swiss'

export default function UnplayedTab({ rounds, players, isAdmin, onResultChange }) {
  const playerMap = {}
  players.forEach(p => { playerMap[p.id] = p })

  // All rounds except the last
  const relevantRounds = rounds.slice(0, -1)

  const unplayed = []
  relevantRounds.forEach(round => {
    round.pairings.forEach(p => {
      if (!p.is_bye && !p.result) {
        unplayed.push({ ...p, round_number: round.round_number, round_id: round.id })
      }
    })
  })

  const handleResult = async (roundId, pairingId, result) => {
    if (!isAdmin) return
    const pairing = rounds.find(r => r.id === roundId)?.pairings.find(p => p.id === pairingId)
    const newResult = pairing?.result === result ? null : result
    const { error } = await supabase.from('pairings').update({ result: newResult }).eq('id', pairingId)
    if (!error) {
      onResultChange(roundId, pairingId, newResult)
    }
  }

  const resultLabel = (result) => {
    if (result === '1-0') return '1-0'
    if (result === '0-1') return '0-1'
    if (result === 'draw') return '½-½'
    return ''
  }

  const scores = calcScores(players, rounds)

  if (rounds.length <= 1) {
    return (
      <div className="notice notice-ok">
        ✓ Ni preteklih krogov za prikaz.
      </div>
    )
  }

  if (unplayed.length === 0) {
    return (
      <div className="notice notice-ok">
        ✓ Vse partije so odigrane.
      </div>
    )
  }

  return (
    <div>
      <div className="notice notice-warn" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="dot-orange"/>
        {unplayed.length} {unplayed.length === 1 ? 'neodigrana partija' : unplayed.length < 5 ? 'neodigrane partije' : 'neodigranih partij'} iz preteklih krogov
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Krog</th>
              <th>Beli</th>
              <th style={{ textAlign: 'right' }}>Točke</th>
              <th style={{ textAlign: 'center' }}>Rezultat</th>
              <th>Točke</th>
              <th>Črni</th>
            </tr>
          </thead>
          <tbody>
            {unplayed.map(p => {
              const w = playerMap[p.white_player_id]
              const b = playerMap[p.black_player_id]
              return (
                <tr key={p.id}>
                  <td style={{ color: 'var(--text2)', fontSize: 12, whiteSpace: 'nowrap' }}>
                    Krog {p.round_number}
                  </td>
                  <td style={{ fontWeight: 500 }}>{w?.name || '?'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="score-cell">{fmtScore(scores[p.white_player_id] || 0)}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {isAdmin ? (
                      <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
                        {[['1-0', 'sel-win', '1-0'], ['draw', 'sel-draw', '½-½'], ['0-1', 'sel-loss', '0-1']].map(([val, cls, label]) => (
                          <button
                            key={val}
                            className={`res-btn${p.result === val ? ' ' + cls : ''}`}
                            onClick={() => handleResult(p.round_id, p.id, val)}
                          >{label}</button>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text3)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className="score-cell">{fmtScore(scores[p.black_player_id] || 0)}</span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{b?.name || '?'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
