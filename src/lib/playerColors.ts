// 7 distinct player colors as HSL values
export const PLAYER_COLORS = [
  { name: 'Green',    hsl: '145 80% 50%',  hex: '#22c55e' },
  { name: 'Cyan',     hsl: '185 80% 50%',  hex: '#06b6d4' },
  { name: 'Gold',     hsl: '45 100% 50%',  hex: '#eab308' },
  { name: 'Pink',     hsl: '330 80% 60%',  hex: '#ec4899' },
  { name: 'Orange',   hsl: '25 95% 55%',   hex: '#f97316' },
  { name: 'Rose',     hsl: '0 80% 55%',    hex: '#ef4444' },
  { name: 'Lavender', hsl: '270 60% 70%',  hex: '#a78bfa' },
] as const;

export const MAX_PLAYERS = 7;

export type PlayerColor = typeof PLAYER_COLORS[number];
