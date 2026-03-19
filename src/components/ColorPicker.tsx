import { PLAYER_COLORS, EAGLE_COLOR_INDICES } from '@/lib/playerColors';
import type { GameMode } from '@/lib/gameTypes';

interface Props {
  currentColorIndex: number;
  usedColorIndices: Set<number>;
  onColorSelect: (colorIndex: number) => void;
  gameMode: GameMode;
}

export default function ColorPicker({ currentColorIndex, usedColorIndices, onColorSelect, gameMode }: Props) {
  // In 1v3, hide eagle colors so players only pick chick colors
  const availableColors = PLAYER_COLORS.map((color, idx) => ({ color, idx })).filter(({ idx }) => {
    if (gameMode === '1v3') return !EAGLE_COLOR_INDICES.includes(idx);
    return true;
  });

  const half = Math.ceil(availableColors.length / 2);
  const topRow = availableColors.slice(0, half);
  const bottomRow = availableColors.slice(half);

  const renderButton = ({ color, idx }: { color: typeof PLAYER_COLORS[number]; idx: number }) => {
    const isMine = idx === currentColorIndex;
    const isTaken = usedColorIndices.has(idx) && !isMine;
    const isEagleColor = EAGLE_COLOR_INDICES.includes(idx);
    const showEagleOutline = gameMode === '2v6' && isEagleColor;
    // Button size: slightly larger for 2v6 (8 colors fit 4+4)
    const btnSize = gameMode === '2v6' ? 'w-10 h-10' : 'w-9 h-9';

    return (
      <button
        key={idx}
        onClick={() => !isTaken && onColorSelect(idx)}
        disabled={isTaken}
        title={isTaken ? `${color.name} (taken)` : showEagleOutline ? `${color.name} (Eagle role)` : color.name}
        className={`${btnSize} rounded-full transition-all relative ${
          isMine
            ? 'scale-125'
            : isTaken
              ? 'opacity-30 cursor-not-allowed'
              : 'hover:scale-110 cursor-pointer'
        }`}
        style={{
          backgroundColor: isTaken ? 'hsl(var(--muted))' : `hsl(${color.hsl})`,
          border: showEagleOutline
            ? '3px solid hsl(0 80% 55%)'
            : isMine
              ? '2px solid hsl(var(--foreground))'
              : '2px solid transparent',
          boxShadow: isMine
            ? `0 0 12px hsl(${color.hsl} / 0.6)`
            : showEagleOutline && !isTaken
              ? '0 0 8px hsl(0 80% 55% / 0.5)'
              : 'none',
        }}
      >
        {/* Eagle indicator badge */}
        {showEagleOutline && !isTaken && (
          <span
            className="absolute -top-1.5 -right-1.5 text-[8px] bg-destructive rounded-full w-3.5 h-3.5 flex items-center justify-center"
            style={{ fontSize: 8, lineHeight: 1 }}
          >
            🦅
          </span>
        )}
      </button>
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
      {gameMode === '2v6' && (
        <p className="text-[9px] font-mono text-muted-foreground mt-1">
          🦅 Red border = Eagle role
        </p>
      )}
    </div>
  );
}
