import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { calcScores, genPairings, fmtScore, autoMaxRounds } from '../../lib/swiss'

export default function RoundTab({
  round,
  roundIndex,
  allRounds,
  players,
  tournament,
  isAdmin,
  onResultChange,
  onDeleteRound,
  onNewRound,
  onTabChange,
  onFinish,
}) {
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [generating, setGenerating] = useState(false)

  const isLatest = roundIndex === allRounds.length - 1
  const maxR = tournament?.max_rounds || autoMaxRounds(players.length)
  const isComplete = allRounds.length >= maxR
  const allEntered = round.pairings.every(p => p.is_bye || p.result)
  const pendingCount = round.pairings.filter(p => !p.is_bye && !p.result).length

  // Scores before this round
  const prevRounds = allRounds.slice(0, roundIndex)
  const scores = calcScores(players, prevRounds)

  const playerMap = {}
  players.forEach(p => { playerMap[p.id] = p })

  const handleResult = async (pairingId, result) => {
    if (!isAdmin) return
    const pairing = round.pairings.find(p => p.id === pairingId)
    const newResult = pairing?.result === result ? null : result
    const { error } = await supabase
      .from('pairings')
      .update({ result: newResult })
      .eq('id', pairingId)
    if (!error) {
      onResultChange(round.id, pairingId, newResult)
    }
  }

  const exportExcel = () => {
    const rows = [['#', 'Beli', 'Točke', 'Rezultat', 'Točke', 'Črni']]
    round.pairings.forEach((p) => {
      const w = playerMap[p.white_player_id]
      const b = playerMap[p.black_player_id]
      if (p.is_bye) {
        rows.push([p.board_number, w?.name || '', fmtScore(scores[p.white_player_id] || 0), 'bye', '', ''])
      } else {
        const resultStr = p.result === 'draw' ? '0.5-0.5' : (p.result || '')
        rows.push([
          p.board_number,
          w?.name || '',
          fmtScore(scores[p.white_player_id] || 0),
          resultStr,
          fmtScore(scores[p.black_player_id] || 0),
          b?.name || ''
        ])
      }
    })
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `Krog ${round.round_number}`)
    XLSX.writeFile(wb, `${tournament?.name || 'turnir'}_krog${round.round_number}.xlsx`)
  }

  const generateNextRound = async () => {
    setGenerating(true)
    try {
      const nextNum = round.round_number + 1
      const { data: newRound, error: re } = await supabase
        .from('rounds')
        .insert({ tournament_id: tournament.id, round_number: nextNum, is_custom: false })
        .select()
        .single()
      if (re) throw re

      const pairings = genPairings(players, allRounds)
      const toInsert = pairings.map(p => ({ ...p, round_id: newRound.id }))
      const { data: insertedPairings, error: pe } = await supabase.from('pairings').insert(toInsert).select()
      if (pe) throw pe

      const roundObj = { ...newRound, pairings: insertedPairings || [] }
      onNewRound(roundObj)
      onTabChange(`round-${newRound.id}`)
    } catch (err) {
      console.error(err)
    }
    setGenerating(false)
  }

  const handleDelete = async () => {
    await supabase.from('rounds').delete().eq('id', round.id)
    setDeleteConfirm(false)
    onDeleteRound(round.id)
  }

  const resultLabel = (result) => {
    if (result === '1-0') return '1-0'
    if (result === '0-1') return '0-1'
    if (result === 'draw') return '½-½'
    return ''
  }

  const ResultButtons = ({ pairing }) => {
    if (!isAdmin) {
      if (!pairing.result) return <span style={{ color: 'var(--text3)' }}>—</span>
      const label = resultLabel(pairing.result)
      const cls = pairing.result === '1-0' ? 'badge badge-ok' : pairing.result === '0-1' ? 'badge badge-err' : 'badge badge-warn'
      return <span className={cls}>{label}</span>
    }
    return (
      <div style={{ display: 'flex', gap: 3 }}>
        {[['1-0', 'sel-win', '1-0'], ['draw', 'sel-draw', '½-½'], ['0-1', 'sel-loss', '0-1']].map(([val, cls, label]) => (
          <button
            key={val}
            className={`res-btn${pairing.result === val ? ' ' + cls : ''}`}
            onClick={() => handleResult(pairing.id, val)}
          >{label}</button>
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Card header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Krog {round.round_number} — pari</span>
          {round.is_custom && (
            <span className="badge badge-info">ročno</span>
          )}
        </div>
        <span style={{ fontSize: 13, color: 'var(--text2)' }}>
          {round.pairings.filter(p => p.is_bye || p.result).length} / {round.pairings.length} vnesenih
        </span>
      </div>

      {pendingCount > 0 && (
        <div className="notice notice-warn" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="dot-orange"/>
          {pendingCount} {pendingCount === 1 ? 'partija čaka' : pendingCount < 5 ? 'partije čakajo' : 'partij čaka'} na rezultat
        </div>
      )}

      {/* Pairings table */}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>#</th>
              <th>Beli</th>
              <th style={{ textAlign: 'right' }}>Točke</th>
              <th style={{ textAlign: 'center' }}>Rezultat</th>
              <th>Točke</th>
              <th>Črni</th>
            </tr>
          </thead>
          <tbody>
            {round.pairings.map(p => {
              const w = playerMap[p.white_player_id]
              const b = playerMap[p.black_player_id]
              if (p.is_bye) {
                return (
                  <tr key={p.id}>
                    <td style={{ color: 'var(--text3)', fontSize: 12 }}>
                      {p.board_number}
                    </td>
                    <td colSpan={2} style={{ fontWeight: 500 }}>{w?.name || '?'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-info">1 točka (bye)</span>
                    </td>
                    <td colSpan={2} style={{ color: 'var(--text3)' }}>—</td>
                  </tr>
                )
              }
              const pending = !p.result
              return (
                <tr key={p.id}>
                  <td style={{ color: 'var(--text3)', fontSize: 12 }}>
                    {pending ? <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>{p.board_number}<span className="dot-orange"/></span> : p.board_number}
                  </td>
                  <td style={{ fontWeight: 500 }}>{w?.name || '?'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="score-cell">{fmtScore(scores[p.white_player_id] || 0)}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <ResultButtons pairing={p} />
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

      {/* Action row */}
      {isAdmin && (
        <div className="action-row">
          <button className="btn btn-sm btn-danger" onClick={() => setDeleteConfirm(!deleteConfirm)}>
            Izbriši krog
          </button>
          <button className="btn btn-sm" onClick={exportExcel}>⬇ Izvozi Excel</button>
          {isLatest && (
            <button className="btn btn-sm" onClick={() => onTabChange('custom')}>
              + Uvozi ročno rundo
            </button>
          )}
          {isLatest && !isComplete && allEntered && (
            <button
              className="btn btn-primary btn-sm"
              onClick={generateNextRound}
              disabled={generating}
            >
              {generating ? 'Žrebam…' : `Žrebaj krog ${round.round_number + 1} →`}
            </button>
          )}
          {isLatest && isComplete && allEntered && (
            <button className="btn btn-primary btn-sm" onClick={onFinish}>
              Končna razvrstitev →
            </button>
          )}
          {!isLatest && (
            <button className="btn btn-sm" onClick={() => onTabChange(`round-${allRounds[allRounds.length - 1].id}`)}>
              Na zadnji krog →
            </button>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="notice notice-err" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>Res želite izbrisati krog {round.round_number}? To je nepopravljivo.</span>
          <button className="btn btn-sm btn-danger" onClick={handleDelete}>Da, izbriši</button>
          <button className="btn btn-sm" onClick={() => setDeleteConfirm(false)}>Prekliči</button>
        </div>
      )}
    </div>
  )
}
