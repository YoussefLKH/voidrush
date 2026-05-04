// ─── Winners Leaderboard (localStorage) ──────────────────────────────────────

const STORAGE_KEY = 'voidrush_winners';
const MAX_ENTRIES = 10;

const BLOCKLIST = [
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock',
  'nigger', 'nigga', 'faggot', 'fag', 'pussy', 'asshole',
];

export interface Winner {
  name:  string;
  score: number;
  date:  string;
}

export function getWinners(): Winner[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Winner[]) : [];
  } catch { return []; }
}

export function containsProfanity(name: string): boolean {
  const lower = name.toLowerCase().replace(/[^a-z]/g, '');
  return BLOCKLIST.some((w) => lower.includes(w));
}

export function addWinner(name: string, score: number): void {
  const clean = name.trim().replace(/[^\w\s\-]/g, '').replace(/\s+/g, ' ').slice(0, 16).trim();
  if (!clean || containsProfanity(clean)) return;

  const now     = new Date();
  const months  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const date    = `${months[now.getMonth()]} ${now.getDate()} ${now.getFullYear()}`;

  const winners = getWinners();
  winners.push({ name: clean, score, date });
  winners.sort((a, b) => b.score - a.score);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(winners.slice(0, MAX_ENTRIES)));
}

export function clearWinners(): void {
  localStorage.removeItem(STORAGE_KEY);
}
