export function trigrams(s: string): Set<string> {
  const n = `  ${s.toLowerCase().replace(/[^a-z0-9]/g, "")}  `;
  const out = new Set<string>();
  for (let i = 0; i < n.length - 2; i++) out.add(n.slice(i, i + 3));
  return out;
}

export function jaccard(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  const inter = [...ta].filter((x) => tb.has(x)).length;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface MatchCandidate {
  id: string;
  name: string;
  nameNormalized: string;
}

export interface MatchResult {
  id: string;
  name: string;
  score: number;
}

export function findTopMatches(
  query: string,
  candidates: MatchCandidate[],
  topN = 3,
): MatchResult[] {
  return candidates
    .map((c) => ({ id: c.id, name: c.name, score: jaccard(query, c.nameNormalized) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

export function autoMatch(
  matches: MatchResult[],
  threshold = 0.7,
  gap = 0.15,
): string | null {
  if (matches.length === 0) return null;
  const top = matches[0];
  if (top.score < threshold) return null;
  const second = matches[1]?.score ?? 0;
  if (top.score - second < gap) return null;
  return top.id;
}
