/** XP required to advance from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return 5 * level * level + 40 * level + 100;
}

export interface LevelInfo {
  level: number;
  currentLevelXp: number;
  requiredXp: number;
}

export function getLevelInfo(totalXp: number): LevelInfo {
  let remaining = totalXp;
  let level = 0;

  while (true) {
    const needed = xpForLevel(level);

    if (remaining < needed) {
      return { level, currentLevelXp: remaining, requiredXp: needed };
    }

    remaining -= needed;
    level++;
  }
}
