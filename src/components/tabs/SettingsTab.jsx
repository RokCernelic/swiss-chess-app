import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { autoMaxRounds, genPairings } from '../../lib/swiss'

export default function SettingsTab({ tournament, players, rounds, onPlayersChange, onTournamentUpdate, onRoundsChange, onTabChange }) {
  const [newName, setNewName] = useState('')
  const [newRating, setNewRating] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editRating, setEditRating] = useState('')
  const [maxRounds, setMaxRounds] = useState(tournament?.max_rounds || '')
  const [savingRounds, setSavingRounds] = useState(false)
  const [starting, setStarting] = useState(false)
  const fileRef = useRef()

  const suggested = autoMaxRounds(players.length)

  const addPlayer = async () => {
    const name = newName.trim()
    if (!name) return
    const rating = newRating ? parseInt(newRating) : null
    const { data, error } = await supabase
      .from('players')
      .insert({ tournament_id: tournament.id, name, rating, seed: players.length })
      .select()
      .single()
    if (!error && data) {
      onPlayersChange([...players, data])
      setNewName('')
      setNewRating('')
    }
  }

  const deletePlayer = async (id) => {
    await supabase.from('players').delete().eq('id', id)
    onPlayersChange(players.filter(p => p.id !== id))
  }

  const startEdit = (p) => {
    setEditingId(p.id)
    setEditName(p.name)
    setEditRating(p.rating != null ? String(p.rating) : '')
  }

  const saveEdit = async (id) => {
    const name = editName.trim()
    if (!name) return
    const rating = editRating ? parseInt(editRating) : null
    const { error } = await supabase.from('players').update({ name, rating }).eq('id', id)
    if (!error) {
      onPlayersChange(players.map(p => p.id === id ? { ...p, name, rating } : p))
    }
    setEditingId(null)
  }

  const cancelEdit = () => setEditingId(null)

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const data = ev.target.result
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
      const imported = []
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        if (!row || row.length === 0) continue
        const last = String(row[0] || '').trim()
        const first = String(row[1] || '').trim()
        if (!last && !first) continue
        const name = first && last ? `${first} ${last}` : (first || last)
        const rating = row[2] ? parseInt(row[2]) : null
        imported.push({ name, rating })
      }
      if (imported.length === 0) return
      const toInsert = imported.map((p, i) => ({
        tournament_id: tournament.id,
        name: p.name,
        rating: p.rating,
        seed: players.length + i
      }))
      const { data: inserted, error } = await supabase.from('players').insert(toInsert).select()
      if (!error && inserted) {
        onPlayersChange([...players, ...inserted])
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  const exportPlayers = () => {
    const rows = [['Priimek', 'Ime', 'ELO']]
    players.forEach(p => {
      const parts = p.name.split(' ')
      const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : p.name
      const last = parts.length > 1 ? parts[parts.length - 1] : ''
      rows.push([last, first, p.rating || ''])
    })
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Igralci')
    XLSX.writeFile(wb, `${(tournament?.name || 'turnir').replace(/\s+/g, '_')}_igralci.xlsx`)
  }

  const saveMaxRounds = async () => {
    const val = parseInt(maxRounds)
    if (!val || val < 1) return
    setSavingRounds(true)
    const { error } = await supabase.from('tournaments').update({ max_rounds: val }).eq('id', tournament.id)
    if (!error) {
      onTournamentUpdate({ ...tournament, max_rounds: val })
    }
    setSavingRounds(false)
  }

  const startTournament = async () => {
    if (players.length < 2) return
    setStarting(true)
    try {
      const mr = tournament.max_rounds || autoMaxRounds(players.length)
      // Ensure max_rounds is set
      if (!tournament.max_rounds) {
        await supabase.from('tournaments').update({ max_rounds: mr }).eq('id', tournament.id)
        onTournamentUpdate({ ...tournament, max_rounds: mr, phase: 'active' })
      }
      // Create round 1
      const { data: round, error: re } = await supabase
        .from('rounds')
        .insert({ tournament_id: tournament.id, round_number: 1, is_custom: false })
        .select()
        .single()
      if (re) throw re

      const pairings = genPairings(players, [])
      const toInsert = pairings.map(p => ({ ...p, round_id: round.id }))
      const { data: insertedPairings, error: pe } = await supabase.from('pairings').insert(toInsert).select()
      if (pe) throw pe

      await supabase.from('tournaments').update({ phase: 'active' }).eq('id', tournament.id)
      onTournamentUpdate({ ...tournament, phase: 'active', max_rounds: mr })

      const newRound = { ...round, pairings: insertedPairings || [] }
      onRoundsChange([...rounds, newRound])
      onTabChange(`round-${round.id}`)
    } catch (err) {
      console.error(err)
    }
    setStarting(false)
  }

  const exportJSON = () => {
    const data = JSON.stringify({ tournament, players, rounds }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tournament.name.replace(/\s+/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importJSONRef = useRef()
  const importJSON = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (data.players && Array.isArray(data.players)) {
          // Re-import players (replace all)
          await supabase.from('players').delete().eq('tournament_id', tournament.id)
          const toInsert = data.players.map(p => ({ ...p, id: undefined, tournament_id: tournament.id }))
          const { data: inserted } = await supabase.from('players').insert(toInsert).select()
          if (inserted) onPlayersChange(inserted)
        }
      } catch (err) {
        console.error('JSON import error', err)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const canStart = players.length >= 2 && tournament?.phase === 'setup'

  return (
    <div>
      {/* Import from Excel */}
      <div className="card">
        <div className="section-label">Uvozi igralce iz Excela</div>
        <p style={{ fontSize: 13, color: 'var(--text2)', margin: '4px 0 10px' }}>
          Stolpci: A = priimek, B = ime, C = ELO. Prva vrstica je glava (preskočena).
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.ods,.csv"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => fileRef.current.click()}>
            ⬆ Uvozi Excel / CSV
          </button>
          <button className="btn" onClick={exportPlayers} disabled={players.length === 0}>
            ⬇ Izvozi seznam igralcev
          </button>
        </div>
      </div>

      {/* Add player manually */}
      <div className="card">
        <div className="section-label">Dodaj igralca</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <input
            className="input"
            style={{ flex: '2 1 160px' }}
            placeholder="Ime Priimek"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPlayer()}
          />
          <input
            className="input"
            style={{ flex: '1 1 80px' }}
            placeholder="ELO"
            type="number"
            value={newRating}
            onChange={e => setNewRating(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPlayer()}
          />
          <button className="btn btn-primary" onClick={addPlayer} disabled={!newName.trim()}>
            + Dodaj
          </button>
        </div>
      </div>

      {/* Player list */}
      {players.length > 0 && (
        <div className="card">
          <div className="section-label" style={{ marginBottom: 8 }}>
            Igralci ({players.length})
          </div>
          <div className="player-list">
            <table className="data-table">
              <tbody>
                {players.map((p, i) => (
                  <tr key={p.id} className={editingId === p.id ? 'editing-row' : ''}>
                    <td style={{ width: 30, color: 'var(--text3)', fontSize: 12 }}>{i + 1}</td>
                    {editingId === p.id ? (
                      <>
                        <td>
                          <input
                            className="input"
                            style={{ padding: '3px 6px', fontSize: 13 }}
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(p.id); if (e.key === 'Escape') cancelEdit(); }}
                            autoFocus
                          />
                        </td>
                        <td style={{ width: 80 }}>
                          <input
                            className="input"
                            style={{ padding: '3px 6px', fontSize: 13 }}
                            type="number"
                            value={editRating}
                            onChange={e => setEditRating(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(p.id); if (e.key === 'Escape') cancelEdit(); }}
                          />
                        </td>
                        <td style={{ width: 70 }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-sm" onClick={() => saveEdit(p.id)}>✓</button>
                            <button className="btn btn-sm" onClick={cancelEdit}>✕</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ fontWeight: 500 }}>{p.name}</td>
                        <td style={{ color: 'var(--text2)', fontSize: 13 }}>{p.rating || '—'}</td>
                        <td style={{ width: 70 }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-sm" onClick={() => startEdit(p)} title="Uredi">✎</button>
                            <button
                              className="btn btn-sm"
                              style={{ color: 'var(--err-tx)' }}
                              onClick={() => deletePlayer(p.id)}
                              title="Izbriši"
                            >×</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Round count */}
      <div className="card">
        <div className="section-label">Število krogov</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <input
            className="input"
            style={{ width: 80 }}
            type="number"
            min="1"
            max="20"
            value={maxRounds}
            onChange={e => setMaxRounds(e.target.value)}
            placeholder={String(suggested)}
          />
          <button className="btn" onClick={saveMaxRounds} disabled={savingRounds}>
            Nastavi
          </button>
          {tournament?.max_rounds ? (
            <span className="chip">Nastavljeno: {tournament.max_rounds} krogov</span>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>
              Priporočeno za {players.length} igralcev: <strong>{suggested}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Start tournament */}
      {tournament?.phase === 'setup' && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            style={{ fontSize: 15, padding: '10px 20px' }}
            onClick={startTournament}
            disabled={!canStart || starting}
          >
            {starting ? 'Žrebam…' : 'Začni turnir →'}
          </button>
          {players.length < 2 && (
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>Potrebujete vsaj 2 igralca.</span>
          )}
        </div>
      )}

      {tournament?.phase === 'active' && (
        <div className="notice notice-info">
          Turnir je aktiven. Nastavitve igralcev so zaklenjene.
        </div>
      )}

      {/* Export / Import JSON */}
      <div className="action-row" style={{ borderTop: 'none', paddingTop: 0, marginTop: 16 }}>
        <button className="btn btn-sm" onClick={exportJSON}>⬇ Izvozi JSON</button>
        <input ref={importJSONRef} type="file" accept=".json" style={{ display: 'none' }} onChange={importJSON} />
        <button className="btn btn-sm" onClick={() => importJSONRef.current.click()}>⬆ Uvozi JSON</button>
      </div>
    </div>
  )
}
