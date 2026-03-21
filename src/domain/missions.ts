/**
 * Mission progression is stored in the legacy-style `tp` bitfield. Docking
 * flows and external gameplay events both contribute flags, but they do so in
 * different places so the UI can show new briefings only after the commander
 * safely reaches a station.
 */
export const TP_MISSION_FLAGS = {
  constrictorBriefed: 1 << 0,
  constrictorCompleted: 1 << 1,
  thargoidPlansBriefed: 1 << 2,
  thargoidPlansCompleted: 1 << 3,
  trumblesUnlocked: 1 << 4,
  trumblesResolved: 1 << 5
} as const;

export type MissionVariant = 'classic' | 'c64' | 'nes';
export type MissionFlagName = keyof typeof TP_MISSION_FLAGS;

export type MissionExternalEvent =
  | { type: 'travel:constrictor-zone-visited' }
  | { type: 'combat:constrictor-destroyed' }
  | { type: 'travel:thargoid-contact-system' }
  | { type: 'combat:thargoid-plans-delivered' }
  | { type: 'economy:trumbles-purchased' }
  | { type: 'economy:trumbles-eradicated' };

export interface MissionProgress {
  tp: number;
  variant: MissionVariant;
}

export interface MissionMessage {
  id: string;
  kind: 'briefing' | 'debriefing';
  title: string;
  body: string;
}

export function hasMissionFlag(tp: number, flag: MissionFlagName): boolean {
  return (tp & TP_MISSION_FLAGS[flag]) !== 0;
}

export function withMissionFlag(tp: number, flag: MissionFlagName): number {
  return tp | TP_MISSION_FLAGS[flag];
}

function supportsConstrictor(variant: MissionVariant): boolean {
  return variant === 'classic';
}

function supportsTrumbles(variant: MissionVariant): boolean {
  return variant === 'c64' || variant === 'nes';
}

export function getMissionMessagesForDocking(progress: MissionProgress): MissionMessage[] {
  const nextTp = progress.tp;
  const messages: MissionMessage[] = [];

  // Docking briefings are derived from the already-applied mission state so the
  // caller can decide when to persist the underlying flag changes.
  if (supportsConstrictor(progress.variant) && !hasMissionFlag(nextTp, 'constrictorBriefed')) {
    messages.push({
      id: 'constrictor-briefing',
      kind: 'briefing',
      title: 'Navy Briefing: Constrictor',
      body: 'A prototype Constrictor has been stolen. Track and destroy the ship for a Navy reward.'
    });
  }

  if (
    supportsConstrictor(progress.variant) &&
    hasMissionFlag(nextTp, 'constrictorCompleted') &&
    !hasMissionFlag(nextTp, 'thargoidPlansBriefed')
  ) {
    messages.push({
      id: 'thargoid-plans-briefing',
      kind: 'briefing',
      title: 'Navy Briefing: Thargoid Plans',
      body: 'Deliver stolen Thargoid plans through hostile space to support naval defenses.'
    });
  }

  if (supportsTrumbles(progress.variant) && hasMissionFlag(nextTp, 'trumblesUnlocked')) {
    messages.push({
      id: 'trumbles-debriefing',
      kind: 'debriefing',
      title: 'Station Advisory: Trumbles',
      body: 'Dock authorities report Trumble activity in cargo bays. Containment rewards are available.'
    });
  }

  if (hasMissionFlag(nextTp, 'thargoidPlansCompleted')) {
    messages.push({
      id: 'thargoid-plans-debriefing',
      kind: 'debriefing',
      title: 'Navy Debrief: Plans Delivered',
      body: 'Command confirms delivery. Your standing has improved and naval pay is credited.'
    });
  }

  return messages;
}

export function applyMissionExternalEvent(progress: MissionProgress, event: MissionExternalEvent): MissionProgress {
  let tp = progress.tp;

  switch (event.type) {
    case 'travel:constrictor-zone-visited':
      if (supportsConstrictor(progress.variant)) {
        tp = withMissionFlag(tp, 'constrictorBriefed');
      }
      break;
    case 'combat:constrictor-destroyed':
      if (supportsConstrictor(progress.variant)) {
        tp = withMissionFlag(withMissionFlag(tp, 'constrictorBriefed'), 'constrictorCompleted');
      }
      break;
    case 'travel:thargoid-contact-system':
      // Contact with the route system unlocks the delivery leg even before the
      // commander returns to a station for the next briefing text.
      tp = withMissionFlag(tp, 'thargoidPlansBriefed');
      break;
    case 'combat:thargoid-plans-delivered':
      tp = withMissionFlag(withMissionFlag(tp, 'thargoidPlansBriefed'), 'thargoidPlansCompleted');
      break;
    case 'economy:trumbles-purchased':
      if (supportsTrumbles(progress.variant)) {
        tp = withMissionFlag(tp, 'trumblesUnlocked');
      }
      break;
    case 'economy:trumbles-eradicated':
      if (supportsTrumbles(progress.variant)) {
        tp = withMissionFlag(withMissionFlag(tp, 'trumblesUnlocked'), 'trumblesResolved');
      }
      break;
  }

  return {
    ...progress,
    tp
  };
}

export function applyDockingMissionState(progress: MissionProgress): MissionProgress {
  let tp = progress.tp;

  // Some classic missions advance automatically once the commander docks, even
  // if no separate combat/travel event fired during the trip.
  if (supportsConstrictor(progress.variant) && !hasMissionFlag(tp, 'constrictorBriefed')) {
    tp = withMissionFlag(tp, 'constrictorBriefed');
  }

  if (hasMissionFlag(tp, 'constrictorCompleted') && !hasMissionFlag(tp, 'thargoidPlansBriefed')) {
    tp = withMissionFlag(tp, 'thargoidPlansBriefed');
  }

  return {
    ...progress,
    tp
  };
}
