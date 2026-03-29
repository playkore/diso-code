/**
 * Neutral travel mission context
 * ------------------------------
 *
 * The current game no longer exposes custom mission content in the docked UI,
 * but the combat encounter layer still accepts a small context object so
 * future canonical Elite mission hooks can influence spawns without growing a
 * second ad-hoc parameter list.
 */
export interface MissionTravelContext {
  effectiveDestinationSystem: string;
  primaryObjectiveText: string;
  pirateSpawnMultiplier: number;
  policeHostile: boolean;
  policeSuppressed: boolean;
  blockadeAtDestination: boolean;
  missionTargetSystems: string[];
}

/**
 * Travel starts with a neutral context unless a canonical scripted mission
 * later needs to override encounter pressure or destination text.
 */
export function createDefaultMissionTravelContext(destinationSystem: string): MissionTravelContext {
  return {
    effectiveDestinationSystem: destinationSystem,
    primaryObjectiveText: `Travel to ${destinationSystem}.`,
    pirateSpawnMultiplier: 1,
    policeHostile: false,
    policeSuppressed: false,
    blockadeAtDestination: false,
    missionTargetSystems: []
  };
}
