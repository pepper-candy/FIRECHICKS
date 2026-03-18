import { PLAYER_COLORS } from '@/lib/playerColors';

interface Props {
  currentColorIndex: number;
  usedColorIndices: Set<number>;
  onColorSelect: (colorIndex: number) => void;
}

export default function ColorPicker({ currentColorIndex, usedColorIndices, onColorSelect }: Props) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {PLAYER_COLORS.map((color, idx) => {
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
      })}
    </div>
  );
}
