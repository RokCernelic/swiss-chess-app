// Scoring
export function calcScores(players, rounds) {
  const s = {};
  players.forEach(p => s[p.id] = 0);
  rounds.forEach(round => {
    round.pairings.forEach(({ white_player_id, black_player_id, result, is_bye }) => {
      if (is_bye) { s[white_player_id] = (s[white_player_id] || 0) + 1; return; }
      if (!result) return;
      if (result === '1-0') s[white_player_id] = (s[white_player_id] || 0) + 1;
      else if (result === '0-1') s[black_player_id] = (s[black_player_id] || 0) + 1;
      else if (result === 'draw') {
        s[white_player_id] = (s[white_player_id] || 0) + 0.5;
        s[black_player_id] = (s[black_player_id] || 0) + 0.5;
      }
    });
  });
  return s;
}

export function calcBuchholz(players, rounds, scores) {
  const b = {};
  players.forEach(p => b[p.id] = 0);
  rounds.forEach(round => {
    round.pairings.forEach(({ white_player_id, black_player_id, is_bye }) => {
      if (is_bye || !white_player_id || !black_player_id) return;
      b[white_player_id] = (b[white_player_id] || 0) + (scores[black_player_id] || 0);
      b[black_player_id] = (b[black_player_id] || 0) + (scores[white_player_id] || 0);
    });
  });
  return b;
}

export function autoMaxRounds(n) { return n <= 4 ? 3 : n <= 8 ? 4 : 5; }

export function fmtScore(s) { return s === Math.floor(s) ? String(s) : s.toFixed(1); }

// Generate pairings for next round
// players: array of {id, name, rating}
// rounds: array of {pairings: [{white_player_id, black_player_id, result, is_bye}]}
// Returns array of {white_player_id, black_player_id, result: null, is_bye, board_number}
export function genPairings(players, rounds) {
  const scores = calcScores(players, rounds);

  // Build opponent history and color balance
  const opp = {}, colors = {};
  players.forEach(p => { opp[p.id] = new Set(); colors[p.id] = 0; });
  rounds.forEach(round => {
    round.pairings.forEach(({ white_player_id, black_player_id, is_bye }) => {
      if (is_bye || !white_player_id || !black_player_id) return;
      opp[white_player_id].add(black_player_id);
      opp[black_player_id].add(white_player_id);
      colors[white_player_id] = (colors[white_player_id] || 0) + 1;
      colors[black_player_id] = (colors[black_player_id] || 0) - 1;
    });
  });

  const hadBye = new Set(
    rounds.flatMap(r => r.pairings.filter(p => p.is_bye).map(p => p.white_player_id))
  );

  const sorted = [...players].sort((a, b) => {
    const sd = (scores[b.id] || 0) - (scores[a.id] || 0);
    return sd !== 0 ? sd : (b.rating || 0) - (a.rating || 0);
  });

  let pool = [...sorted], byeP = null;
  if (pool.length % 2 === 1) {
    for (let i = pool.length - 1; i >= 0; i--) {
      if (!hadBye.has(pool[i].id)) { byeP = pool[i]; pool.splice(i, 1); break; }
    }
    if (!byeP) byeP = pool.pop();
  }

  const pairings = [], paired = new Set();
  const half = pool.length / 2;
  const top = pool.slice(0, half), bottom = pool.slice(half);

  for (let i = 0; i < top.length; i++) {
    const a = top[i]; let bestJ = -1;
    for (let k = 0; k < bottom.length; k++) {
      const j = (i + k) % bottom.length;
      if (!paired.has(bottom[j].id) && !opp[a.id].has(bottom[j].id)) { bestJ = j; break; }
    }
    if (bestJ === -1) {
      for (let j = 0; j < bottom.length; j++) {
        if (!paired.has(bottom[j].id)) { bestJ = j; break; }
      }
    }
    if (bestJ !== -1) {
      const b = bottom[bestJ];
      let wId = a.id, bId = b.id;
      if ((colors[a.id] || 0) > (colors[b.id] || 0)) { wId = b.id; bId = a.id; }
      pairings.push({ white_player_id: wId, black_player_id: bId, result: null, is_bye: false, board_number: pairings.length + 1 });
      paired.add(a.id); paired.add(b.id);
    }
  }

  if (byeP) pairings.push({ white_player_id: byeP.id, black_player_id: null, result: 'bye', is_bye: true, board_number: pairings.length + 1 });

  return pairings;
}

// Name matching for custom round import
export function matchPlayer(raw, players) {
  if (!raw || !raw.trim()) return null;
  const norm = s => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
  const n = norm(raw);
  let p = players.find(x => norm(x.name) === n); if (p) return p.id;
  const parts = n.split(' ');
  if (parts.length >= 2) {
    const sw = [...parts.slice(1), parts[0]].join(' ');
    p = players.find(x => norm(x.name) === sw); if (p) return p.id;
    const sw2 = [parts[parts.length - 1], ...parts.slice(0, parts.length - 1)].join(' ');
    p = players.find(x => norm(x.name) === sw2); if (p) return p.id;
  }
  p = players.find(x => norm(x.name).includes(n) || n.includes(norm(x.name)));
  return p ? p.id : null;
}

export function parseResult(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s || s === '-' || s === '?' || s === 'x') return null;
  if (['1-0','1:0','white','beli'].includes(s)) return '1-0';
  if (['0-1','0:1','black','črni','crni'].includes(s)) return '0-1';
  if (['1/2','½','0.5','draw','remi','remis','1/2-1/2','½-½','0.5-0.5'].includes(s)) return 'draw';
  return null;
}
