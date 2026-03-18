// Grade scale from highest to lowest
export const GRADE_SCALE = [4.3, 4, 3.7, 3.3, 3, 2.7, 2.3, 2, 1.7, 1, 0] as const;

export const GRADE_LETTERS: Record<number, string> = {
  4.3: 'A+', 4: 'A', 3.7: 'A-',
  3.3: 'B+', 3: 'B', 2.7: 'B-',
  2.3: 'C+', 2: 'C', 1.7: 'C-',
  1: 'D', 0: 'F',
};

export const STARTING_HEALTH = 4.3;

export function gradeToLetter(health: number): string {
  // Find closest grade
  let closest = GRADE_SCALE[GRADE_SCALE.length - 1];
  for (const g of GRADE_SCALE) {
    if (Math.abs(g - health) < Math.abs(closest - health)) closest = g;
  }
  return GRADE_LETTERS[closest] ?? 'F';
}

export function snapToGrade(health: number): number {
  let closest = GRADE_SCALE[GRADE_SCALE.length - 1] as number;
  let minDiff = Infinity;
  for (const g of GRADE_SCALE) {
    const diff = Math.abs(g - health);
    if (diff < minDiff) { minDiff = diff; closest = g; }
  }
  return closest;
}

/** Drop N steps in the grade scale (lower = worse). Returns snapped grade. */
export function dropGrades(currentHealth: number, steps: number): number {
  const idx = GRADE_SCALE.indexOf(snapToGrade(currentHealth) as typeof GRADE_SCALE[number]);
  if (idx === -1) return 0;
  const newIdx = Math.min(idx + steps, GRADE_SCALE.length - 1);
  const newGrade = GRADE_SCALE[newIdx];
  // Below 1.7 → 1, below 1 → 0
  if (newGrade < 1.7 && newGrade > 1) return 1;
  if (newGrade < 1) return 0;
  return newGrade;
}

/** Apply attack damage: drop 2 grades */
export function applyDamage(currentHealth: number): number {
  return dropGrades(currentHealth, 2);
}

/** Heal: raise 1 grade step (if not max) */
export function applyHeal(currentHealth: number): number {
  const idx = GRADE_SCALE.indexOf(snapToGrade(currentHealth) as typeof GRADE_SCALE[number]);
  if (idx <= 0) return GRADE_SCALE[0]; // already max
  return GRADE_SCALE[idx - 1];
}

/** Add sub-grades (positive = improve, negative = worsen) */
export function addSubGrades(currentHealth: number, steps: number): number {
  const idx = GRADE_SCALE.indexOf(snapToGrade(currentHealth) as typeof GRADE_SCALE[number]);
  if (idx === -1) return 0;
  const newIdx = Math.max(0, Math.min(idx - steps, GRADE_SCALE.length - 1));
  const newGrade = GRADE_SCALE[newIdx];
  if (newGrade < 1.7 && newGrade > 1) return 1;
  if (newGrade < 1) return 0;
  return newGrade;
}

export function isDead(health: number): boolean {
  return snapToGrade(health) === 0;
}

export function getGradeColor(health: number): string {
  const grade = snapToGrade(health);
  if (grade >= 3.7) return 'hsl(145 80% 50%)';   // A range - green
  if (grade >= 2.7) return 'hsl(45 100% 55%)';    // B range - gold
  if (grade >= 1.7) return 'hsl(30 90% 55%)';     // C range - orange
  if (grade >= 1) return 'hsl(0 80% 55%)';        // D - red
  return 'hsl(0 0% 40%)';                          // F - grey
}
