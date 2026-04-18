import { COLOR_CODE_PALETTE, COLOR_CODE_LETTERS, isColorCode, letterToHex } from "@/lib/colorCode";

interface ColorCodeBallsProps {
  /** A 4-letter color code (e.g. "YORP"). If invalid, renders nothing. */
  code: string;
  /** Diameter of each ball in pixels. */
  size?: number;
  /** Gap between balls in pixels. */
  gap?: number;
  className?: string;
}

/**
 * Read-only display of a 4-color room code as colored circles.
 * Used on host lobby and on the client active-rooms list.
 */
export function ColorCodeBalls({ code, size = 18, gap = 6, className = "" }: ColorCodeBallsProps) {
  if (!isColorCode(code)) return null;
  return (
    <span
      className={`inline-flex items-center align-middle ${className}`}
      style={{ gap: `${gap}px` }}
      aria-label={`Room code ${code}`}
    >
      {code.split("").map((letter, idx) => (
        <span
          key={`${letter}-${idx}`}
          className="rounded-full border border-foreground/30 shadow-[0_0_6px_rgba(0,0,0,0.3)]"
          style={{
            width: size,
            height: size,
            background: letterToHex(letter),
          }}
        />
      ))}
    </span>
  );
}

interface ColorCodePickerProps {
  /** Current 4-letter code (controlled). */
  value: string;
  /** Called with the new 4-letter code after each click. */
  onChange: (next: string) => void;
  /** Diameter of each ball in pixels. */
  size?: number;
  className?: string;
}

/**
 * Interactive 4-ball picker. Each click cycles a slot through the 4 colors
 * (Y → O → R → P → Y …). Default value when none provided is the natural
 * order "YORP". Players don't need to enter unique colors — the host's code
 * is independent and clients just need to match the displayed pattern.
 */
export function ColorCodePicker({ value, onChange, size = 56, className = "" }: ColorCodePickerProps) {
  const safe = value && value.length === COLOR_CODE_PALETTE.length
    ? value
    : COLOR_CODE_LETTERS.join("");
  const cycle = (idx: number) => {
    const letters = safe.split("");
    const cur = letters[idx];
    const curPos = COLOR_CODE_LETTERS.indexOf(cur);
    const nextLetter = COLOR_CODE_LETTERS[(curPos + 1) % COLOR_CODE_LETTERS.length];
    letters[idx] = nextLetter;
    onChange(letters.join(""));
  };
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      {safe.split("").map((letter, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => cycle(idx)}
          className="rounded-full border-2 border-border shadow-lg active:scale-95 transition-transform"
          style={{
            width: size,
            height: size,
            background: letterToHex(letter),
          }}
          aria-label={`Slot ${idx + 1}, currently ${letter}`}
        />
      ))}
    </div>
  );
}
