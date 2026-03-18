import type { ChickColor } from '@/components/CharacterViewer';

export const PLAYER_COLORS = [
  { name: 'Black', hsl: '0 0% 20%',      hex: '#333333', chickColor: 'Black' as ChickColor },
  { name: 'Gold',  hsl: '45 100% 50%',    hex: '#FFD700', chickColor: 'Gold' as ChickColor },
  { name: 'Red',   hsl: '0 80% 55%',      hex: '#e53e3e', chickColor: 'Red' as ChickColor },
  { name: 'Yellow',hsl: '48 96% 53%',     hex: '#facc15', chickColor: 'Yellow' as ChickColor },
  { name: 'Blue',  hsl: '220 80% 55%',    hex: '#3b82f6', chickColor: 'Blue' as ChickColor },
  { name: 'Green', hsl: '145 80% 50%',    hex: '#22c55e', chickColor: 'Green' as ChickColor },
  { name: 'Cyan',  hsl: '185 80% 50%',    hex: '#06b6d4', chickColor: 'Cyan' as ChickColor },
  { name: 'Pink',  hsl: '330 80% 60%',    hex: '#ec4899', chickColor: 'Pink' as ChickColor },
] as const;

export const EAGLE_COLOR_INDICES = [0, 1]; // Black=0, Gold=1
export const MAX_PLAYERS = 8;
export const MAX_PLAYERS_1V3 = 4;
export const MAX_PLAYERS_2V6 = 8;

export type PlayerColor = typeof PLAYER_COLORS[number];
