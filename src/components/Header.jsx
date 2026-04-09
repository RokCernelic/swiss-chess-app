import { useState, useEffect, useRef } from 'react'
import ChessBoard from './ChessBoard'
import { supabase } from '../lib/supabase'
import { fmtScore } from '../lib/swiss'

export default function Header({ tournament, players, rounds, onTournamentUpdate, isAdmin = true, isPublic = false }) {
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(tournament?.name || '')
  const [notes, setNotes] = useState(tournament?.notes || '')
  const notesTimer = useRef(null)

  useEffect(() => {
    setNameVal(tournament?.name || '')
    setNotes(tournament?.notes || '')
  }, [tournament?.name, tournament?.notes])

  const saveName = async () => {
    const trimmed = nameVal.trim()
    if (!trimmed) { setNameVal(tournament.name); setEditingName(false); return; }
    const { error } = await supabase.from('tournaments').update({ name: trimmed }).eq('id', tournament.id)
    if (!error) {
      onTournamentUpdate && onTournamentUpdate({ ...tournament, name: trimmed })
    }
    setEditingName(false)
  }

  const cancelName = () => {
    setNameVal(tournament.name)
    setEditingName(false)
  }

  const handleNotesChange = (e) => {
    const val = e.target.value
    setNotes(val)
    clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(async () => {
      await supabase.from('tournaments').update({ notes: val }).eq('id', tournament.id)
      onTournamentUpdate && onTournamentUpdate({ ...tournament, notes: val })
    }, 600)
  }

  // Build subtitle
  let subtitle = null
  if (tournament?.phase === 'active' && rounds && rounds.length > 0) {
    const lastRound = rounds[rounds.length - 1]
    const totalRounds = tournament.max_rounds || '?'
    const playerCount = players?.length || 0
    const pendingCount = rounds.reduce((acc, r) =>
      acc + r.pairings.filter(p => !p.is_bye && !p.result).length, 0
    )
    subtitle = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
        <span style={{ color: 'var(--text2)', fontSize: 13 }}>
          Krog {lastRound.round_number} od {totalRounds} · {playerCount} {playerCount === 1 ? 'igralec' : playerCount < 5 ? 'igralci' : 'igralcev'}
        </span>
        {pendingCount > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--warn-tx)', fontSize: 13 }}>
            <span className="dot-orange"/>
            {pendingCount} {pendingCount === 1 ? 'neodločena' : pendingCount < 5 ? 'neodločene' : 'neodločenih'}
          </span>
        )}
        {isPublic && tournament.phase === 'active' && (
          <span className="live-badge" style={{ marginLeft: 4 }}>
            <span className="live-dot"/>
            Živo
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="header-wrap">
      <div className="header-left">
        <div className="title-row">
          {editingName && isAdmin ? (
            <>
              <input
                className="input"
                style={{ fontSize: 18, fontWeight: 700, padding: '4px 8px', width: 'auto', flexGrow: 1 }}
                value={nameVal}
                onChange={e => setNameVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') cancelName(); }}
                autoFocus
              />
              <button className="btn btn-sm" onClick={saveName} title="Shrani">✓</button>
              <button className="btn btn-sm" onClick={cancelName} title="Prekliči">✕</button>
            </>
          ) : (
            <>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
                {tournament?.name || 'Chess Tournament'}
              </h1>
              {isAdmin && (
                <button
                  className="btn btn-sm"
                  style={{ padding: '2px 8px', fontSize: 13 }}
                  onClick={() => setEditingName(true)}
                  title="Uredi ime"
                >✎</button>
              )}
            </>
          )}
        </div>
        {subtitle}
        <textarea
          className="notes-area"
          style={{ marginTop: 10, fontSize: 15, maxWidth: '100%' }}
          placeholder={isAdmin ? 'Opombe turnirja…' : ''}
          value={notes}
          onChange={isAdmin ? handleNotesChange : undefined}
          readOnly={!isAdmin}
          rows={notes ? undefined : 2}
        />
      </div>
      <div className="header-right">
        <ChessBoard />
      </div>
    </div>
  )
}
