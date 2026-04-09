import { calcScores, calcBuchholz, fmtScore, autoMaxRounds } from './swiss.js'

export { calcScores, calcBuchholz, fmtScore, autoMaxRounds }

// Build standings array sorted by score then buchholz then rating
export function buildStandings(players, rounds) {
  const scores = calcScores(players, rounds);
  const buchholz = calcBuchholz(players, rounds, scores);

  const sorted = [...players].sort((a, b) => {
    const sd = (scores[b.id] || 0) - (scores[a.id] || 0);
    if (sd !== 0) return sd;
    const bd = (buchholz[b.id] || 0) - (buchholz[a.id] || 0);
    if (bd !== 0) return bd;
    return (b.rating || 0) - (a.rating || 0);
  });

  return sorted.map(p => ({ ...p, score: scores[p.id] || 0, buchholz: buchholz[p.id] || 0 }));
}
