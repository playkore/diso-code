/**
 * Shared RPG progression rules copied from the prototype engine.
 *
 * The docked commander model and the live travel-combat session both read from
 * this module so level thresholds, HP growth, and attack scaling cannot drift
 * apart between the station UI and in-flight rewards.
 */
export interface RpgProgressionState {
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  attack: number;
}

export const RPG_STARTING_LEVEL = 1;
export const RPG_STARTING_XP = 0;
export const RPG_STARTING_MAX_HP = 60;
export const RPG_STARTING_ATTACK = 9;
export const RPG_LEVEL_MAX_HP_GAIN = 14;
export const RPG_LEVEL_ATTACK_GAIN = 3;

/**
 * Enemy XP follows the original quadratic prototype curve so higher-level
 * systems pay out sharply more progression than the safe early systems.
 */
export function xpForEnemyLevel(level: number): number {
  const normalizedLevel = Math.max(1, Math.trunc(level));
  return Math.round(10 + 4 * (normalizedLevel - 1) ** 2 + 2 * (normalizedLevel - 1));
}

/**
 * Promotion thresholds stay intentionally simple and deterministic so the HUD
 * can show exact progress without caching or lookup tables.
 */
export function xpToNextLevel(level: number): number {
  const normalizedLevel = Math.max(1, Math.trunc(level));
  return 28 + normalizedLevel * 20;
}

function maxHpForLevel(level: number) {
  return RPG_STARTING_MAX_HP + Math.max(0, Math.trunc(level) - RPG_STARTING_LEVEL) * RPG_LEVEL_MAX_HP_GAIN;
}

function attackForLevel(level: number) {
  return RPG_STARTING_ATTACK + Math.max(0, Math.trunc(level) - RPG_STARTING_LEVEL) * RPG_LEVEL_ATTACK_GAIN;
}

/**
 * Old saves can be missing some or all RPG fields. Normalization rebuilds the
 * omitted values from the commander level and then clamps HP into that range.
 */
export function normalizeRpgProgression(progress: Partial<RpgProgressionState> = {}): RpgProgressionState {
  const level = Math.max(RPG_STARTING_LEVEL, Math.trunc(progress.level ?? RPG_STARTING_LEVEL));
  const maxHp = Math.max(1, Math.trunc(progress.maxHp ?? maxHpForLevel(level)));
  const attack = Math.max(1, Math.trunc(progress.attack ?? attackForLevel(level)));
  return {
    level,
    xp: Math.max(0, Math.trunc(progress.xp ?? RPG_STARTING_XP)),
    hp: Math.max(0, Math.min(maxHp, Math.trunc(progress.hp ?? maxHp))),
    maxHp,
    attack
  };
}

/**
 * XP awards can trigger multiple promotions in one docking or combat outcome.
 *
 * The function returns both the fully updated stats and a level-up counter so
 * callers can decide whether to show a dedicated message without re-deriving
 * promotion transitions from the final numbers alone.
 */
export function awardRpgXp(progress: RpgProgressionState, amount: number) {
  const normalized = normalizeRpgProgression(progress);
  const grantedXp = Math.max(0, Math.trunc(amount));
  let next: RpgProgressionState = {
    ...normalized,
    xp: normalized.xp + grantedXp
  };
  let levelUps = 0;

  while (next.xp >= xpToNextLevel(next.level)) {
    next.xp -= xpToNextLevel(next.level);
    next.level += 1;
    next.maxHp += RPG_LEVEL_MAX_HP_GAIN;
    next.attack += RPG_LEVEL_ATTACK_GAIN;
    // Promotions fully repair the commander just like the prototype engine.
    next.hp = next.maxHp;
    levelUps += 1;
  }

  return {
    progression: next,
    grantedXp,
    levelUps
  };
}
