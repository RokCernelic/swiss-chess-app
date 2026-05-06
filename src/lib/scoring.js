import { calcScores, calcBuchholz, fmtScore, autoMaxRounds } from './swiss.js'

export { calcScores, calcBuchholz, fmtScore, autoMaxRounds }

// Count wins, losses, draws per player
export function calcWLD(players, rounds) {
  const wld = {};
  players.forEach(p => { wld[p.id] = { w: 0, l: 0, d: 0 }; });
  rounds.forEach(round => {
    round.pairings.forEach(({ white_player_id, black_player_id, result, is_bye }) => {
      if (is_bye) { if (wld[white_player_id]) wld[white_player_id].w++; return; }
      if (!result) return;
      if (result === '1-0') {
        if (wld[white_player_id]) wld[white_player_id].w++;
        if (wld[black_player_id]) wld[black_player_id].l++;
      } else if (result === '0-1') {
        if (wld[white_player_id]) wld[white_player_id].l++;
        if (wld[black_player_id]) wld[black_player_id].w++;
      } else if (result === 'draw') {
        if (wld[white_player_id]) wld[white_player_id].d++;
        if (wld[black_player_id]) wld[black_player_id].d++;
      }
    });
  });
  return wld;
}

// Build standings array sorted by score then buchholz then rating
export function buildStandings(players, rounds) {
  const scores = calcScores(players, rounds);
  const buchholz = calcBuchholz(players, rounds, scores);
  const wld = calcWLD(players, rounds);

  const sorted = [...players].sort((a, b) => {
    const sd = (scores[b.id] || 0) - (scores[a.id] || 0);
    if (sd !== 0) return sd;
    const bd = (buchholz[b.id] || 0) - (buchholz[a.id] || 0);
    if (bd !== 0) return bd;
    return (b.rating || 0) - (a.rating || 0);
  });

  return sorted.map(p => ({
    ...p,
    score: scores[p.id] || 0,
    buchholz: buchholz[p.id] || 0,
    wins: wld[p.id]?.w || 0,
    losses: wld[p.id]?.l || 0,
    draws: wld[p.id]?.d || 0,
  }));
}
