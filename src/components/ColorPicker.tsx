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
    const btnSize = gameMode === '2v6' ? 'w-11 h-11' : 'w-9 h-9';
    // Black (index 0) is near-invisible on dark backgrounds — use a light inner ring to show it
    const isBlack = idx === 0;

    return (
      <button
        key={idx}
        onClick={() => !isTaken && onColorSelect(idx)}
        disabled={isTaken}
        title={isTaken ? `${color.name} (taken)` : showEagleOutline ? `${color.name} (Eagle role 🦅)` : color.name}
        className={`${btnSize} rounded-full transition-all relative ${
          showEagleOutline ? 'animate-pulse' : ''
        } ${
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
              : isBlack
                ? '2px solid hsl(0 0% 60%)'
                : '2px solid transparent',
          boxShadow: isMine
            ? `0 0 12px hsl(${color.hsl} / 0.6)`
            : showEagleOutline && !isTaken
              ? '0 0 10px hsl(0 80% 55% / 0.7)'
              : 'none',
        }}
      >
        {/* Eagle role badge — always visible for eagle colors in 2v6 */}
        {showEagleOutline && (
          <span
            className="absolute inset-0 flex items-center justify-center text-[13px] font-bold"
            style={{ pointerEvents: 'none', textShadow: '0 0 4px #000, 0 0 8px #000' }}
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
    </div>
  );
}
