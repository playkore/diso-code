/**
 * Mission system
 * --------------
 *
 * The original prototype stored campaign progress in a tiny bitfield. That was
 * enough for a fixed set of legacy missions, but it is too brittle for
 * branching cargo jobs, route modifiers, or mission-specific combat spawns.
 *
 * This module replaces that bitfield with explicit mission instances. Each
 * instance owns its stage, mission-only cargo, routing modifiers, inbox
 * messages, and any pending player choices. Store slices and combat/travel code
 * talk to this module through pure functions so mission logic stays testable.
 */

export type MissionTemplateId =
  | 'decoy_cargo'
  | 'secret_courier'
  | 'station_blockade'
  | 'named_pirate_hunt'
  | 'double_delivery'
  | 'rescue_pickup';

export type MissionStatus = 'offered' | 'active' | 'completed' | 'failed' | 'declined';

export type MissionStageId =
  | 'briefing'
  | 'outbound'
  | 'pickup'
  | 'return'
  | 'search'
  | 'intercept'
  | 'choice'
  | 'handoff'
  | 'debrief'
  | 'completed'
  | 'failed';

export type MissionMessageKind = 'briefing' | 'warning' | 'reveal' | 'choice' | 'debriefing';

export interface MissionChoice {
  id: string;
  label: string;
  description: string;
}

export interface MissionMessage {
  id: string;
  missionId: string;
  kind: MissionMessageKind;
  title: string;
  body: string;
  choices?: MissionChoice[];
  dismissed?: boolean;
}

export interface MissionCargoDefinition {
  key: string;
  name: string;
  amount: number;
  tonnagePerUnit: number;
  legalBadnessPerUnit: number;
  sellable: boolean;
  dumpable: boolean;
  destinationSystem?: string;
}

export interface MissionCargoItem extends MissionCargoDefinition {
  missionId: string;
}

export interface MissionRuntimeEffect {
  pirateSpawnMultiplier?: number;
  policeHostile?: boolean;
  policeSuppressed?: boolean;
  blockadeAtDestination?: boolean;
  missionTargetSystem?: string;
  missionTargetBlueprintId?: string;
  missionTargetRole?: 'target' | 'escort' | 'ambusher' | 'blockade' | 'scan-hostile';
  revealOnJump?: boolean;
  alternateDestinationSystem?: string;
  deliveryCommodityKey?: string;
  deliveryCommodityAmount?: number;
}

export interface MissionOffer {
  id: string;
  templateId: MissionTemplateId;
  title: string;
  briefing: string;
  originSystem: string;
  destinationSystem: string;
  reward: number;
  deadline: number | null;
  cargo?: MissionCargoDefinition[];
  runtimeEffect?: MissionRuntimeEffect;
  objectiveText: string;
}

export interface MissionInstance {
  id: string;
  templateId: MissionTemplateId;
  title: string;
  status: MissionStatus;
  stageId: MissionStageId;
  originSystem: string;
  destinationSystem: string;
  currentDestinationSystem: string;
  alternateDestinationSystem?: string;
  reward: number;
  deadline: number | null;
  objectiveText: string;
  cargo: MissionCargoDefinition[];
  runtimeEffect: MissionRuntimeEffect;
  localFlags: Record<string, boolean>;
  targetSystems?: string[];
}

export interface MissionHistoryEntry {
  missionId: string;
  templateId: MissionTemplateId;
  title: string;
  outcome: 'completed' | 'failed' | 'declined';
  summary: string;
}

export interface MissionTravelContext {
  effectiveDestinationSystem: string;
  primaryObjectiveText: string;
  activeEffects: MissionRuntimeEffect[];
  pirateSpawnMultiplier: number;
  policeHostile: boolean;
  policeSuppressed: boolean;
  blockadeAtDestination: boolean;
  missionTargetSystems: string[];
  missionMessages: MissionMessage[];
}

export type MissionEvent =
  | { type: 'travel:jump-completed'; destinationSystem: string }
  | { type: 'travel:arrived'; systemName: string }
  | { type: 'mission:message-shown'; missionId: string; flag: string }
  | { type: 'mission:choice-made'; missionId: string; choiceId: string }
  | { type: 'mission:target-destroyed'; missionId: string }
  | { type: 'mission:escort-lost'; missionId: string }
  | { type: 'mission:cargo-delivered'; missionId: string; systemName: string }
  | { type: 'mission:pickup-completed'; missionId: string; systemName: string }
  | { type: 'mission:search-system-visited'; systemName: string }
  | { type: 'mission:contact-inspected'; missionId: string; systemName: string };

export interface MissionGenerationContext {
  currentSystem: string;
  nearbySystems: string[];
  stardate: number;
}

export interface MissionRouteContext {
  originSystem: string;
  destinationSystem: string;
}

export interface MissionDockingContext {
  currentSystem: string;
}

export interface MissionTradeContext {
  systemName: string;
  commodityKey: string;
  amount: number;
}

export interface MissionSettlement {
  activeMissions: MissionInstance[];
  completedMissions: MissionHistoryEntry[];
  cashDelta: number;
}

function createMissionId(templateId: MissionTemplateId, currentSystem: string, index: number) {
  return `${templateId}:${currentSystem}:${index}`;
}

function hasFlag(mission: MissionInstance, flag: string) {
  return Boolean(mission.localFlags[flag]);
}

function setFlag(mission: MissionInstance, flag: string, value = true): MissionInstance {
  return {
    ...mission,
    localFlags: {
      ...mission.localFlags,
      [flag]: value
    }
  };
}

function createOffer(
  templateId: MissionTemplateId,
  currentSystem: string,
  destinationSystem: string,
  reward: number,
  objectiveText: string,
  briefing: string,
  cargo: MissionCargoDefinition[] = [],
  runtimeEffect: MissionRuntimeEffect = {},
  index = 0
): MissionOffer {
  return {
    id: createMissionId(templateId, currentSystem, index),
    templateId,
    title: TEMPLATE_TITLES[templateId],
    briefing,
    originSystem: currentSystem,
    destinationSystem,
    reward,
    deadline: null,
    cargo,
    runtimeEffect,
    objectiveText
  };
}

const TEMPLATE_TITLES: Record<MissionTemplateId, string> = {
  decoy_cargo: 'Decoy Cargo',
  secret_courier: 'Secret Courier',
  station_blockade: 'Station Blockade',
  named_pirate_hunt: 'Named Pirate Hunt',
  double_delivery: 'Double Delivery',
  rescue_pickup: 'Rescue Pickup'
};

/**
 * Offer generation is deterministic from the local route neighborhood. The
 * current implementation keeps one curated offer per requested template so the
 * new framework is usable immediately without adding a second procedural layer.
 */
export function generateMissionOffers(context: MissionGenerationContext): MissionOffer[] {
  const nearby = context.nearbySystems.filter((name) => name !== context.currentSystem);
  const first = nearby[0] ?? context.currentSystem;
  const second = nearby[1] ?? first;
  const third = nearby[2] ?? second;

  return [
    createOffer(
      'decoy_cargo',
      context.currentSystem,
      first,
      1400,
      `Carry medical crates to ${first} and survive pirate attention.`,
      'Transport sealed medical supplies. Expect interference en route.',
      [
        {
          key: 'medical_crates',
          name: 'Medical Crates',
          amount: 4,
          tonnagePerUnit: 1,
          legalBadnessPerUnit: 0,
          sellable: false,
          dumpable: true,
          destinationSystem: first
        }
      ],
      { pirateSpawnMultiplier: 2.4, revealOnJump: true },
      0
    ),
    createOffer(
      'secret_courier',
      context.currentSystem,
      second,
      2200,
      `Courier sealed dispatches to ${second}; expect hostile scrutiny.`,
      'Move a compact packet under irregular inspection conditions.',
      [
        {
          key: 'sealed_dispatches',
          name: 'Sealed Dispatches',
          amount: 1,
          tonnagePerUnit: 0,
          legalBadnessPerUnit: 2,
          sellable: false,
          dumpable: false,
          destinationSystem: second
        }
      ],
      { policeHostile: true, alternateDestinationSystem: third },
      1
    ),
    createOffer(
      'station_blockade',
      context.currentSystem,
      third,
      2600,
      `Break the blockade and deliver relief supplies to ${third}.`,
      'A station is short of essentials. Deliver relief cargo through a pirate cordon.',
      [],
      { blockadeAtDestination: true, deliveryCommodityKey: 'food', deliveryCommodityAmount: 4 },
      2
    ),
    createOffer(
      'named_pirate_hunt',
      context.currentSystem,
      first,
      3000,
      `Track a named pirate through nearby systems and eliminate the target.`,
      'Local brokers have triangulated the pirate to one of several nearby systems.',
      [],
      { missionTargetSystem: second, missionTargetBlueprintId: 'python-pirate', missionTargetRole: 'target' },
      3
    ),
    createOffer(
      'double_delivery',
      context.currentSystem,
      second,
      1800,
      `Deliver bonded cargo to ${second}, but expect competing offers.`,
      'A routine bonded shipment with unusual seal restrictions.',
      [
        {
          key: 'bonded_goods',
          name: 'Bonded Goods',
          amount: 3,
          tonnagePerUnit: 1,
          legalBadnessPerUnit: 1,
          sellable: false,
          dumpable: true,
          destinationSystem: second
        }
      ],
      { alternateDestinationSystem: third },
      4
    ),
    createOffer(
      'rescue_pickup',
      context.currentSystem,
      third,
      2800,
      `Reach ${third}, pick up survivors, then return them safely.`,
      'A contact at the destination needs extraction under pressure.',
      [],
      { pirateSpawnMultiplier: 1.8 },
      5
    )
  ];
}

export function acceptMissionOffer(offer: MissionOffer): {
  mission: MissionInstance;
  missionCargo: MissionCargoItem[];
  acceptedMessage: MissionMessage;
} {
  const mission: MissionInstance = {
    id: offer.id,
    templateId: offer.templateId,
    title: offer.title,
    status: 'active',
    stageId: offer.templateId === 'rescue_pickup' ? 'pickup' : offer.templateId === 'named_pirate_hunt' ? 'search' : 'outbound',
    originSystem: offer.originSystem,
    destinationSystem: offer.destinationSystem,
    currentDestinationSystem: offer.destinationSystem,
    alternateDestinationSystem: offer.runtimeEffect?.alternateDestinationSystem,
    reward: offer.reward,
    deadline: offer.deadline,
    objectiveText: offer.objectiveText,
    cargo: offer.cargo ?? [],
    runtimeEffect: offer.runtimeEffect ?? {},
    localFlags: {},
    targetSystems:
      offer.templateId === 'named_pirate_hunt'
        ? [offer.destinationSystem, offer.runtimeEffect?.missionTargetSystem ?? offer.destinationSystem].filter(Boolean)
        : undefined
  };

  const missionCargo = (offer.cargo ?? []).map<MissionCargoItem>((cargo) => ({
    ...cargo,
    missionId: mission.id
  }));

  return {
    mission,
    missionCargo,
    acceptedMessage: {
      id: `${mission.id}:accepted`,
      missionId: mission.id,
      kind: 'briefing',
      title: offer.title,
      body: offer.briefing
    }
  };
}

export function getMissionTravelContext(activeMissions: MissionInstance[], routeContext: MissionRouteContext): MissionTravelContext {
  const relevantMissions = activeMissions.filter(
    (mission) =>
      mission.status === 'active' &&
      (mission.currentDestinationSystem === routeContext.destinationSystem ||
        mission.destinationSystem === routeContext.destinationSystem ||
        mission.originSystem === routeContext.originSystem)
  );
  const activeEffects = relevantMissions.map((mission) => mission.runtimeEffect);
  const pirateSpawnMultiplier = activeEffects.reduce((multiplier, effect) => multiplier * (effect.pirateSpawnMultiplier ?? 1), 1);

  return {
    effectiveDestinationSystem: relevantMissions[0]?.currentDestinationSystem ?? routeContext.destinationSystem,
    primaryObjectiveText: relevantMissions[0]?.objectiveText ?? `Travel to ${routeContext.destinationSystem}.`,
    activeEffects,
    pirateSpawnMultiplier,
    policeHostile: activeEffects.some((effect) => effect.policeHostile),
    policeSuppressed: activeEffects.some((effect) => effect.policeSuppressed),
    blockadeAtDestination: activeEffects.some((effect) => effect.blockadeAtDestination),
    missionTargetSystems: relevantMissions.flatMap((mission) => mission.targetSystems ?? []).filter(Boolean),
    missionMessages: getMissionInbox(relevantMissions, { currentSystem: routeContext.originSystem })
  };
}

function progressMission(mission: MissionInstance, event: MissionEvent): MissionInstance {
  if (mission.status !== 'active') {
    return mission;
  }

  switch (mission.templateId) {
    case 'decoy_cargo':
      if (event.type === 'travel:jump-completed' && !hasFlag(mission, 'revealed') && mission.runtimeEffect.revealOnJump) {
        return setFlag(mission, 'revealed');
      }
      if (
        event.type === 'mission:cargo-delivered' &&
        event.missionId === mission.id &&
        event.systemName === mission.currentDestinationSystem
      ) {
        return { ...mission, stageId: 'completed', status: 'completed' };
      }
      break;
    case 'secret_courier':
      if (event.type === 'travel:jump-completed' && !hasFlag(mission, 'rerouted') && mission.alternateDestinationSystem) {
        return {
          ...setFlag(mission, 'rerouted'),
          stageId: 'choice',
          currentDestinationSystem: mission.alternateDestinationSystem,
          objectiveText: `Destination updated. Deliver the dispatches to ${mission.alternateDestinationSystem}.`
        };
      }
      if (event.type === 'mission:cargo-delivered' && event.missionId === mission.id) {
        return { ...mission, stageId: 'completed', status: 'completed' };
      }
      break;
    case 'station_blockade':
      if (event.type === 'mission:cargo-delivered' && event.missionId === mission.id) {
        return { ...mission, stageId: 'completed', status: 'completed' };
      }
      break;
    case 'named_pirate_hunt':
      if (event.type === 'mission:search-system-visited' && (mission.targetSystems ?? []).includes(event.systemName)) {
        return { ...mission, stageId: 'intercept' };
      }
      if (event.type === 'mission:target-destroyed' && event.missionId === mission.id) {
        return { ...mission, stageId: 'completed', status: 'completed' };
      }
      break;
    case 'double_delivery':
      if (event.type === 'travel:jump-completed' && !hasFlag(mission, 'choiceOffered') && mission.alternateDestinationSystem) {
        return {
          ...setFlag(mission, 'choiceOffered'),
          stageId: 'choice'
        };
      }
      if (event.type === 'mission:choice-made' && event.missionId === mission.id) {
        if (event.choiceId === 'betray') {
          return {
            ...mission,
            currentDestinationSystem: mission.alternateDestinationSystem ?? mission.currentDestinationSystem,
            objectiveText: `Divert the bonded goods to ${mission.alternateDestinationSystem ?? mission.currentDestinationSystem}.`,
            stageId: 'handoff'
          };
        }
        return {
          ...mission,
          stageId: 'handoff',
          objectiveText: `Stay loyal and deliver to ${mission.destinationSystem}.`
        };
      }
      if (event.type === 'mission:cargo-delivered' && event.missionId === mission.id) {
        return { ...mission, stageId: 'completed', status: 'completed' };
      }
      break;
    case 'rescue_pickup':
      if (
        event.type === 'mission:pickup-completed' &&
        event.missionId === mission.id &&
        event.systemName === mission.destinationSystem
      ) {
        return {
          ...mission,
          stageId: 'return',
          currentDestinationSystem: mission.originSystem,
          objectiveText: `Return the survivors safely to ${mission.originSystem}.`,
          cargo: [
            {
              key: 'survivors',
              name: 'Survivors',
              amount: 2,
              tonnagePerUnit: 1,
              legalBadnessPerUnit: 0,
              sellable: false,
              dumpable: false,
              destinationSystem: mission.originSystem
            }
          ],
          runtimeEffect: {
            ...mission.runtimeEffect,
            pirateSpawnMultiplier: 2.2
          }
        };
      }
      if (event.type === 'mission:cargo-delivered' && event.missionId === mission.id) {
        return { ...mission, stageId: 'completed', status: 'completed' };
      }
      if (event.type === 'mission:escort-lost' && event.missionId === mission.id) {
        return { ...mission, stageId: 'failed', status: 'failed' };
      }
      break;
  }

  return mission;
}

export function applyMissionEvent(activeMissions: MissionInstance[], event: MissionEvent): MissionInstance[] {
  return activeMissions.map((mission) => progressMission(mission, event));
}

export function evaluateDockingMissionState(activeMissions: MissionInstance[], dockingContext: MissionDockingContext): MissionEvent[] {
  return activeMissions.flatMap<MissionEvent>((mission) => {
    if (mission.status !== 'active') {
      return [];
    }
    if (mission.templateId === 'rescue_pickup' && mission.stageId === 'pickup' && dockingContext.currentSystem === mission.destinationSystem) {
      return [{ type: 'mission:pickup-completed', missionId: mission.id, systemName: dockingContext.currentSystem }];
    }
    if (
      mission.currentDestinationSystem === dockingContext.currentSystem &&
      (mission.cargo.length > 0 || mission.templateId === 'station_blockade' || mission.templateId === 'named_pirate_hunt')
    ) {
      if (mission.templateId === 'named_pirate_hunt') {
        return [{ type: 'mission:search-system-visited', systemName: dockingContext.currentSystem }];
      }
      return [{ type: 'mission:cargo-delivered', missionId: mission.id, systemName: dockingContext.currentSystem }];
    }
    if (mission.templateId === 'named_pirate_hunt' && (mission.targetSystems ?? []).includes(dockingContext.currentSystem)) {
      return [{ type: 'mission:search-system-visited', systemName: dockingContext.currentSystem }];
    }
    return [];
  });
}

export function evaluateTradeMissionState(activeMissions: MissionInstance[], tradeContext: MissionTradeContext): MissionEvent[] {
  return activeMissions.flatMap<MissionEvent>((mission) => {
    if (
      mission.status === 'active' &&
      mission.templateId === 'station_blockade' &&
      mission.currentDestinationSystem === tradeContext.systemName &&
      mission.runtimeEffect.deliveryCommodityKey === tradeContext.commodityKey &&
      tradeContext.amount > 0
    ) {
      return [{ type: 'mission:cargo-delivered', missionId: mission.id, systemName: tradeContext.systemName }];
    }
    return [];
  });
}

/**
 * Mission inbox messages are derived from live state so the UI does not need a
 * second manually-synchronized message store.
 */
export function getMissionInbox(activeMissions: MissionInstance[], _context: { currentSystem: string }): MissionMessage[] {
  return activeMissions.flatMap<MissionMessage>((mission) => {
    if (mission.status !== 'active') {
      return [];
    }

    const messages: MissionMessage[] = [
      {
        id: `${mission.id}:objective`,
        missionId: mission.id,
        kind: 'briefing',
        title: mission.title,
        body: mission.objectiveText
      }
    ];

    if (mission.templateId === 'decoy_cargo' && hasFlag(mission, 'revealed')) {
      messages.push({
        id: `${mission.id}:reveal`,
        missionId: mission.id,
        kind: 'reveal',
        title: 'Mission Update',
        body: 'The cargo was a decoy. Pirate traffic is being drawn toward your route.'
      });
    }

    if (mission.templateId === 'secret_courier' && hasFlag(mission, 'rerouted')) {
      messages.push({
        id: `${mission.id}:reroute`,
        missionId: mission.id,
        kind: 'warning',
        title: 'Destination Changed',
        body: `Proceed to ${mission.currentDestinationSystem}. Local authorities on the original route are compromised.`
      });
    }

    if (mission.templateId === 'double_delivery' && mission.stageId === 'choice') {
      messages.push({
        id: `${mission.id}:choice`,
        missionId: mission.id,
        kind: 'choice',
        title: 'Counter-Offer Received',
        body: `A rival contact offers more credits if you divert the cargo to ${mission.alternateDestinationSystem ?? mission.currentDestinationSystem}.`,
        choices: [
          { id: 'stay_loyal', label: 'Stay Loyal', description: 'Keep the original employer and destination.' },
          { id: 'betray', label: 'Betray', description: 'Divert the cargo to the alternate buyer.' }
        ]
      });
    }

    return messages;
  });
}

export function settleCompletedMissions(activeMissions: MissionInstance[], completedMissions: MissionHistoryEntry[]): MissionSettlement {
  let cashDelta = 0;
  const remaining: MissionInstance[] = [];
  const nextHistory = [...completedMissions];

  for (const mission of activeMissions) {
    if (mission.status === 'completed') {
      cashDelta += mission.reward;
      nextHistory.unshift({
        missionId: mission.id,
        templateId: mission.templateId,
        title: mission.title,
        outcome: 'completed',
        summary: `${mission.title} completed for ${mission.reward} credits.`
      });
      continue;
    }
    if (mission.status === 'failed') {
      nextHistory.unshift({
        missionId: mission.id,
        templateId: mission.templateId,
        title: mission.title,
        outcome: 'failed',
        summary: `${mission.title} failed.`
      });
      continue;
    }
    if (mission.status === 'declined') {
      nextHistory.unshift({
        missionId: mission.id,
        templateId: mission.templateId,
        title: mission.title,
        outcome: 'declined',
        summary: `${mission.title} declined.`
      });
      continue;
    }
    remaining.push(mission);
  }

  return {
    activeMissions: remaining,
    completedMissions: nextHistory.slice(0, 12),
    cashDelta
  };
}

export function resolveMissionChoice(activeMissions: MissionInstance[], missionId: string, choiceId: string): MissionInstance[] {
  return applyMissionEvent(activeMissions, { type: 'mission:choice-made', missionId, choiceId });
}

export function dismissMissionMessage(activeMissions: MissionInstance[], _messageId: string): MissionInstance[] {
  return activeMissions;
}

export function getMissionCargoForActiveMissions(activeMissions: MissionInstance[]): MissionCargoItem[] {
  return activeMissions.flatMap((mission) =>
    mission.cargo.map<MissionCargoItem>((cargo) => ({
      ...cargo,
      missionId: mission.id
    }))
  );
}

