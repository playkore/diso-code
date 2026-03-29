import { getGalaxySystems, getSystemByName } from '../galaxyCatalog';
import type {
  ScenarioMissionPanelContext,
  ScenarioPlugin
} from './types';

const PACKAGE_COUNT = 20;
const PACKAGE_PICKUP_RADIUS = 170;
const PACKAGE_VISIBILITY_RADIUS = 1800;
const SYSTEM_SELECTION_STRIDE = 53;

interface SecretPackageRecord {
  id: string;
  systemName: string;
  orbitOffsetX: number;
  orbitOffsetY: number;
  heading: number;
  spinPhase: number;
  pickupRadius: number;
  collected: boolean;
}

export interface SecretPackagesScenarioState {
  packages: SecretPackageRecord[];
  collectedCount: number;
  currentSystem: string;
}

function normalizeAngle(angle: number) {
  let next = angle;
  while (next <= -Math.PI) {
    next += Math.PI * 2;
  }
  while (next > Math.PI) {
    next -= Math.PI * 2;
  }
  return next;
}

function createPackageRecord(systemName: string, systemIndex: number, ordinal: number): SecretPackageRecord {
  const radius = 2200 + ((systemIndex * 97 + ordinal * 173) % 8) * 280;
  const angle = (((systemIndex + 1) * 41 + ordinal * 67) % 360) * (Math.PI / 180);
  return {
    id: `package:${systemName}:${ordinal}`,
    systemName,
    orbitOffsetX: Math.cos(angle) * radius,
    orbitOffsetY: Math.sin(angle) * radius,
    heading: angle,
    spinPhase: ((systemIndex * 29 + ordinal * 17) % 360) * (Math.PI / 180),
    pickupRadius: PACKAGE_PICKUP_RADIUS,
    collected: false
  };
}

function getScenarioSystems(currentSystem: string) {
  const systems = getGalaxySystems();
  const originIndex = getSystemByName(currentSystem)?.index ?? 0;
  const selected: typeof systems = [];
  let cursor = (originIndex * 7 + 13) % systems.length;
  while (selected.length < PACKAGE_COUNT) {
    cursor = (cursor + SYSTEM_SELECTION_STRIDE) % systems.length;
    const candidate = systems[cursor];
    if (!selected.some((entry) => entry.data.name === candidate.data.name)) {
      selected.push(candidate);
    }
  }
  return selected;
}

function getActivePackage(state: SecretPackagesScenarioState, systemName: string) {
  return state.packages.find((entry) => entry.systemName === systemName && !entry.collected) ?? null;
}

export const secretPackagesScenarioPlugin: ScenarioPlugin<SecretPackagesScenarioState> = {
  id: 'secret-packages-20',
  title: 'Secret Packages',
  version: '1.0.0',
  createInitialState(context) {
    const selectedSystems = getScenarioSystems(context.currentSystem);
    return {
      packages: selectedSystems.map((system, index) => createPackageRecord(system.data.name, system.index, index)),
      collectedCount: 0,
      currentSystem: context.currentSystem
    };
  },
  reduce(state, event, api) {
    if (event.type === 'travel:arrived-in-system') {
      return {
        ...state,
        currentSystem: event.systemName
      };
    }

    if (event.type === 'system:docked') {
      return {
        ...state,
        currentSystem: event.systemName
      };
    }

    if (event.type === 'flight:player-moved') {
      const activePackage = getActivePackage(state, event.systemName);
      if (!activePackage) {
        return state;
      }
      const dx = activePackage.orbitOffsetX - event.x;
      const dy = activePackage.orbitOffsetY - event.y;
      if (Math.hypot(dx, dy) <= activePackage.pickupRadius) {
        api.emitSyntheticEvent({
          type: 'flight:collectible-picked',
          collectibleId: activePackage.id,
          systemName: event.systemName
        });
      }
      return state;
    }

    if (event.type === 'flight:collectible-picked') {
      const packageIndex = state.packages.findIndex((entry) => entry.id === event.collectibleId && !entry.collected);
      if (packageIndex < 0) {
        return state;
      }
      const nextPackages = [...state.packages];
      nextPackages[packageIndex] = {
        ...nextPackages[packageIndex],
        collected: true
      };
      const collectedCount = nextPackages.filter((entry) => entry.collected).length;
      const progressBody = `Collected ${collectedCount} of ${PACKAGE_COUNT}.`;
      api.pushTravelMessage(progressBody);
      api.queueUiToast('Package recovered', progressBody);
      if (collectedCount === PACKAGE_COUNT) {
        api.queueUiToast('Scenario complete', 'All 20 secret packages collected.');
      }
      return {
        ...state,
        packages: nextPackages,
        collectedCount
      };
    }

    return state;
  },
  getFlightOverlay(state, context) {
    const activePackage = getActivePackage(state, context.currentSystem);
    if (!activePackage || !context.station) {
      return {
        entities: [],
        statusLine: state.collectedCount >= PACKAGE_COUNT ? 'ALL PACKAGES RECOVERED' : undefined
      };
    }
    const packageX = context.station.x + activePackage.orbitOffsetX;
    const packageY = context.station.y + activePackage.orbitOffsetY;
    const dx = packageX - context.player.x;
    const dy = packageY - context.player.y;
    const distance = Math.hypot(dx, dy);
    const absoluteBearing = Math.atan2(dy, dx);
    const angleRelativeToPlayer = normalizeAngle(absoluteBearing - context.player.angle);
    return {
      directionHint: {
        angleRelativeToPlayer,
        active: true
      },
      entities:
        distance <= PACKAGE_VISIBILITY_RADIUS
          ? [
              {
                id: activePackage.id,
                kind: 'package',
                x: packageX,
                y: packageY,
                heading: activePackage.heading,
                spinPhase: activePackage.spinPhase + distance * 0.0006,
                pickupRadius: activePackage.pickupRadius,
                collected: false
              }
            ]
          : [],
      statusLine: `PACKAGES ${state.collectedCount}/${PACKAGE_COUNT}`
    };
  },
  getMissionPanel(state, context: ScenarioMissionPanelContext) {
    const foundSystems = state.packages.filter((entry) => entry.collected).map((entry) => entry.systemName);
    const activePackage = getActivePackage(state, context.currentSystem);
    const completed = state.collectedCount >= PACKAGE_COUNT;
    return {
      title: 'Secret Packages',
      progressLabel: `${state.collectedCount} / ${PACKAGE_COUNT} collected`,
      status: completed ? 'completed' : 'active',
      summary: completed ? 'All 20 packages collected' : `Found in ${foundSystems.length} systems`,
      detailLines: completed
        ? ['All 20 packages collected']
        : [
            activePackage ? `Package signal detected in ${context.currentSystem}` : `No package signal in ${context.currentSystem}`,
            foundSystems.length > 0 ? `Recovered systems: ${foundSystems.slice(0, 6).join(', ')}${foundSystems.length > 6 ? '...' : ''}` : 'Recovered systems: none yet'
          ]
    };
  },
  getCompletion(state) {
    if (state.collectedCount < PACKAGE_COUNT) {
      return null;
    }
    return {
      completed: true,
      summary: 'All 20 secret packages collected.'
    };
  }
};
