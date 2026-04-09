export default function UnplayedTab({ rounds, players }) {
  const playerMap = {}
  players.forEach(p => { playerMap[p.id] = p })

  // All rounds except the last
  const relevantRounds = rounds.slice(0, -1)

  const unplayed = []
  relevantRounds.forEach(round => {
    round.pairings.forEach(p => {
      if (!p.is_bye && !p.result) {
        const matchId = `${round.round_number}K${String(p.board_number).padStart(2, '0')}`
        unplayed.push({ ...p, round_number: round.round_number, matchId })
      }
    })
  })

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
              <th style={{ width: 60 }}>#</th>
              <th>Krog</th>
              <th>Beli</th>
              <th>Črni</th>
            </tr>
          </thead>
          <tbody>
            {unplayed.map(p => {
              const w = playerMap[p.white_player_id]
              const b = playerMap[p.black_player_id]
              return (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text2)' }}>{p.matchId}</td>
                  <td style={{ fontSize: 13, color: 'var(--text2)' }}>Krog {p.round_number}</td>
                  <td style={{ fontWeight: 500 }}>{w?.name || '?'}</td>
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
