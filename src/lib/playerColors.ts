// 8 distinct player colors as HSL values
export const PLAYER_COLORS = [
  { name: 'Green',   hsl: '145 80% 50%',  hex: '#22c55e' },
  { name: 'Cyan',    hsl: '185 80% 50%',  hex: '#06b6d4' },
  { name: 'Orange',  hsl: '25 95% 55%',   hex: '#f97316' },
  { name: 'Pink',    hsl: '330 80% 60%',  hex: '#ec4899' },
  { name: 'Yellow',  hsl: '45 100% 55%',  hex: '#eab308' },
  { name: 'Blue',    hsl: '220 80% 55%',  hex: '#3b82f6' },
  { name: 'Red',     hsl: '0 80% 55%',    hex: '#ef4444' },
  { name: 'Purple',  hsl: '280 70% 55%',  hex: '#a855f7' },
] as const;

export const MAX_PLAYERS = 8;

export type PlayerColor = typeof PLAYER_COLORS[number];
