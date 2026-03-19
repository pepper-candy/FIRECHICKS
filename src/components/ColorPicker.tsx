import { PLAYER_COLORS, EAGLE_COLOR_INDICES } from '@/lib/playerColors';
import type { GameMode } from '@/lib/gameTypes';

interface Props {
  currentColorIndex: number;
  usedColorIndices: Set<number>;
  onColorSelect: (colorIndex: number) => void;
  gameMode: GameMode;
}

export default function ColorPicker({ currentColorIndex, usedColorIndices, onColorSelect, gameMode }: Props) {
  // Filter colors based on game mode
  const availableColors = PLAYER_COLORS.map((color, idx) => ({ color, idx })).filter(({ idx }) => {
    if (gameMode === '1v3') {
      // Hide eagle colors (Black=0, Gold=1) in 1v3
      return !EAGLE_COLOR_INDICES.includes(idx);
    }
    return true;
  });

  // Split into 2 rows
  const half = Math.ceil(availableColors.length / 2);
  const topRow = availableColors.slice(0, half);
  const bottomRow = availableColors.slice(half);

  const renderButton = ({ color, idx }: { color: typeof PLAYER_COLORS[number]; idx: number }) => {
    const isMine = idx === currentColorIndex;
    const isTaken = usedColorIndices.has(idx) && !isMine;

    return (
      <button
        key={idx}
        onClick={() => !isTaken && onColorSelect(idx)}
        disabled={isTaken}
        className={`w-9 h-9 rounded-full border-2 transition-all ${
          isMine
            ? 'scale-125 border-foreground'
            : isTaken
              ? 'opacity-30 cursor-not-allowed border-transparent'
              : 'border-transparent hover:scale-110 cursor-pointer'
        }`}
        style={{
          backgroundColor: isTaken ? 'hsl(var(--muted))' : `hsl(${color.hsl})`,
          boxShadow: isMine ? `0 0 12px hsl(${color.hsl} / 0.6)` : 'none',
        }}
        title={isTaken ? `${color.name} (taken)` : color.name}
      />
    );
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex justify-center gap-2">
        {topRow.map(renderButton)}
      </div>
      <div className="flex justify-center gap-2">
        {bottomRow.map(renderButton)}
      </div>
    </div>
  );
}
