import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { matchPlayer, parseResult } from '../../lib/swiss'

export default function CustomRoundTab({ tournament, players, rounds, onNewRound, onTabChange }) {
  const [preview, setPreview] = useState([])
  const [targetRound, setTargetRound] = useState(() => (rounds[rounds.length - 1]?.round_number || 0) + 1)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef()

  const defaultTarget = (rounds[rounds.length - 1]?.round_number || 0) + 1
  const isOverwrite = targetRound <= (rounds[rounds.length - 1]?.round_number || 0)
  const existingRound = rounds.find(r => r.round_number === targetRound)

  const parseFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = ev.target.result
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
      const parsed = []
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        if (!row || row.length === 0) continue
        // Format: col0=#, col1=Beli, col2=Točke(W), col3=Rezultat, col4=Točke(B), col5=Črni
        const rawWhite = String(row[1] || '').trim()
        const rawBlack = String(row[5] || '').trim()
        const rawResult = row[3] !== undefined ? String(row[3]) : ''
        const boardNum = parseInt(row[0]) || (parsed.length + 1)
        if (!rawWhite && !rawBlack) continue
        const isBye = !rawBlack || ['bye','prosti','free','prosti krog'].includes(rawBlack.toLowerCase())
          || ['bye'].includes(rawResult.trim().toLowerCase())
        const whiteId = matchPlayer(rawWhite, players)
        const blackId = isBye ? null : matchPlayer(rawBlack, players)
        const result = isBye ? 'bye' : parseResult(rawResult)
        parsed.push({
          rawWhite, rawBlack: isBye ? '' : rawBlack, rawResult,
          white_player_id: whiteId,
          black_player_id: blackId,
          result,
          is_bye: isBye,
          board_number: boardNum,
        })
      }
      setPreview(parsed)
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  const mismatches = preview.filter(p => !p.white_player_id || (!p.is_bye && !p.black_player_id)).length

  const confirmImport = async () => {
    if (mismatches > 0) return
    setImporting(true)
    try {
      let roundId
      if (existingRound) {
        // Overwrite: delete old pairings first
        await supabase.from('pairings').delete().eq('round_id', existingRound.id)
        roundId = existingRound.id
      } else {
        const { data: newRound, error: re } = await supabase
          .from('rounds')
          .insert({
            tournament_id: tournament.id,
            round_number: targetRound,
            is_custom: true
          })
          .select()
          .single()
        if (re) throw re
        roundId = newRound.id
      }

      const toInsert = preview.map(p => ({
        round_id: roundId,
        white_player_id: p.white_player_id,
        black_player_id: p.black_player_id,
        result: p.is_bye ? 'bye' : (p.result || null),
        is_bye: !!p.is_bye,
        board_number: p.board_number,
      }))
      const { data: insertedPairings, error: pe } = await supabase.from('pairings').insert(toInsert).select()
      if (pe) throw pe

      const roundObj = {
        id: roundId,
        tournament_id: tournament.id,
        round_number: targetRound,
        is_custom: true,
        pairings: insertedPairings || []
      }

      onNewRound(roundObj, existingRound?.id)
      onTabChange(`round-${roundId}`)
      setPreview([])
    } catch (err) {
      console.error(err)
    }
    setImporting(false)
  }

  const playerName = (id) => {
    if (!id) return null
    return players.find(p => p.id === id)?.name || '?'
  }

  const resultLabel = (result) => {
    if (result === '1-0') return '1-0'
    if (result === '0-1') return '0-1'
    if (result === 'draw') return '½-½'
    return '—'
  }

  const resultBadge = (result) => {
    if (!result) return <span style={{ color: 'var(--text3)' }}>—</span>
    const cls = result === '1-0' ? 'badge-ok' : result === '0-1' ? 'badge-err' : 'badge-warn'
    return <span className={`badge ${cls}`}>{resultLabel(result)}</span>
  }

  return (
    <div>
      <div className="card">
        <div className="section-label">Uvozi ročno rundo</div>
        <p style={{ fontSize: 13, color: 'var(--text2)', margin: '4px 0 10px' }}>
          Stolpci: A = #, B = Beli, C = Točke, D = Rezultat, E = Točke, F = Črni. Prva vrstica je glava.
        </p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.ods,.csv" style={{ display: 'none' }} onChange={parseFile} />
        <button className="btn" onClick={() => fileRef.current.click()}>⬆ Izberi datoteko</button>
      </div>

      {/* Round target selector */}
      <div className="card" style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-bd)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--warn-tx)', fontWeight: 600, fontSize: 14 }}>Vpiši v krog:</span>
          <input
            className="input"
            type="number"
            min="1"
            style={{ width: 70 }}
            value={targetRound}
            onChange={e => setTargetRound(parseInt(e.target.value) || defaultTarget)}
          />
          {isOverwrite && existingRound && (
            <span className="badge badge-warn">Opozorilo: krog {targetRound} že obstaja — prepisal boš pare!</span>
          )}
        </div>
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Predogled — {preview.length} {preview.length === 1 ? 'par' : preview.length < 5 ? 'pari' : 'parov'}</span>
            {mismatches > 0 && (
              <span className="badge badge-err">{mismatches} neprepoznanih imen</span>
            )}
            {mismatches === 0 && (
              <span className="badge badge-ok">Vse ujema</span>
            )}
          </div>

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
                {preview.map((p, i) => {
                  const wOk = !!p.white_player_id
                  const bOk = p.is_bye || !!p.black_player_id
                  return (
                    <tr key={i}>
                      <td style={{ color: 'var(--text3)', fontSize: 12 }}>{p.board_number}</td>
                      <td>
                        {wOk ? (
                          <span style={{ color: 'var(--ok-tx)', fontWeight: 500 }}>{playerName(p.white_player_id)}</span>
                        ) : (
                          <span style={{ color: 'var(--err-tx)' }}>✕ {p.rawWhite || <em>prazno</em>}</span>
                        )}
                      </td>
                      {p.is_bye ? (
                        <>
                          <td></td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge-info">1 točka (bye)</span>
                          </td>
                          <td></td>
                          <td style={{ color: 'var(--text3)' }}>—</td>
                        </>
                      ) : (
                        <>
                          <td style={{ textAlign: 'right' }}>
                            <span className="score-cell">{p.rawResult ? '' : '—'}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>{resultBadge(p.result)}</td>
                          <td>
                            <span className="score-cell">{p.rawResult ? '' : '—'}</span>
                          </td>
                          <td>
                            {bOk ? (
                              <span style={{ color: 'var(--ok-tx)', fontWeight: 500 }}>{playerName(p.black_player_id)}</span>
                            ) : (
                              <span style={{ color: 'var(--err-tx)' }}>✕ {p.rawBlack || <em>prazno</em>}</span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="action-row">
            <button
              className="btn btn-primary"
              onClick={confirmImport}
              disabled={mismatches > 0 || importing}
            >
              {importing ? 'Uvažam…' : `Potrdi uvoz v krog ${targetRound}`}
            </button>
            <button className="btn" onClick={() => setPreview([])}>Prekliči</button>
          </div>
        </div>
      )}
    </div>
  )
}
