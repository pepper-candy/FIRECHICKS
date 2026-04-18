/**
 * Immersive-mode color room codes.
 *
 * 4 colors → 4-letter code. Each code is a permutation of all 4 colors
 * (no repeats), giving 4! = 24 possible codes.
 *
 * Encoding: each color → letter. Code is the 4 letters in order.
 *   ffeb41 (yellow) = 'Y'
 *   ff9a25 (orange) = 'O'
 *   ff4226 (red)    = 'R'
 *   ff56e2 (pink)   = 'P'
 *
 * The resulting 4-char codes never collide with the existing 6-char
 * alphanumeric codes, so both systems can coexist.
 */

export const COLOR_CODE_PALETTE = [
  { letter: 'Y', hex: '#ffeb41', name: 'Yellow' },
  { letter: 'O', hex: '#ff9a25', name: 'Orange' },
  { letter: 'R', hex: '#ff4226', name: 'Red' },
  { letter: 'P', hex: '#ff56e2', name: 'Pink' },
] as const;

export const COLOR_CODE_LETTERS = COLOR_CODE_PALETTE.map((c) => c.letter) as readonly string[];
export const COLOR_CODE_LENGTH = COLOR_CODE_PALETTE.length;

export function isColorCode(code: string | undefined | null): boolean {
  if (!code || code.length !== COLOR_CODE_LENGTH) return false;
  const seen = new Set<string>();
  for (const ch of code) {
    if (!COLOR_CODE_LETTERS.includes(ch)) return false;
    if (seen.has(ch)) return false;
    seen.add(ch);
  }
  return seen.size === COLOR_CODE_LENGTH;
}

export function letterToHex(letter: string): string {
  const c = COLOR_CODE_PALETTE.find((p) => p.letter === letter);
  return c?.hex ?? '#666666';
}

/** Generate a random permutation code (Fisher-Yates). */
export function randomColorCode(): string {
  const arr = [...COLOR_CODE_LETTERS];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

/** Enumerate all 24 permutations (used to detect exhaustion). */
export function allColorCodes(): string[] {
  const out: string[] = [];
  const letters = [...COLOR_CODE_LETTERS];
  const permute = (arr: string[], start: number) => {
    if (start === arr.length - 1) {
      out.push(arr.join(''));
      return;
    }
    for (let i = start; i < arr.length; i++) {
      [arr[start], arr[i]] = [arr[i], arr[start]];
      permute(arr, start + 1);
      [arr[start], arr[i]] = [arr[i], arr[start]];
    }
  };
  permute(letters, 0);
  return out;
}

/**
 * Try to atomically reserve a color code via the Neon-backed API.
 * Returns the reserved code, or null if all 24 are in use.
 */
export async function reserveColorCode(hostId: string): Promise<string | null> {
  // Try several random permutations first; if many collisions, fall back to
  // requesting any-available from the server.
  const tried = new Set<string>();
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomColorCode();
    if (tried.has(code)) continue;
    tried.add(code);
    try {
      const res = await fetch('/api/reserve-color-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, hostId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.code) return data.code as string;
      } else if (res.status !== 409) {
        // Non-conflict failure — bail to avoid spamming.
        break;
      }
    } catch {
      // Network failure — bail; caller will fall back.
      return null;
    }
  }
  // Last-ditch: ask the server for any available permutation.
  try {
    const res = await fetch('/api/reserve-color-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId, anyAvailable: true }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.code) return data.code as string;
    }
  } catch {}
  return null;
}

/** Release a color code so it can be reused (call when game starts). */
export async function releaseColorCode(code: string): Promise<void> {
  if (!isColorCode(code)) return;
  try {
    await fetch('/api/release-color-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
  } catch {}
}
