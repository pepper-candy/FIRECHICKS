import type { ChickColor } from '@/components/CharacterViewer';

// 1v3 mode: 1 Eagle (Black) + 3 Chicks (Yellow, Green, Cyan)
export const PLAYER_COLORS = [
  { name: 'Eagle',  hsl: '0 0% 20%',     hex: '#333333', chickColor: 'Black' as ChickColor },
  { name: 'Yellow', hsl: '48 96% 53%',    hex: '#facc15', chickColor: 'Yellow' as ChickColor },
  { name: 'Green',  hsl: '145 80% 50%',   hex: '#22c55e', chickColor: 'Green' as ChickColor },
  { name: 'Cyan',   hsl: '185 80% 50%',   hex: '#06b6d4', chickColor: 'Cyan' as ChickColor },
] as const;

export const MAX_PLAYERS = 4;

export type PlayerColor = typeof PLAYER_COLORS[number];
