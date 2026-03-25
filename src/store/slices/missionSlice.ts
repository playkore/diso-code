import {
  acceptMissionOffer,
  dismissMissionMessage as dismissMissionMessageState,
  generateMissionOffers,
  getMissionInbox,
  resolveMissionChoice as resolveMissionChoiceState
} from '../../domain/missions';
import type { GameSlice, GameStore } from '../storeTypes';

/**
 * Mission slice
 * -------------
 *
 * Docked missions are now explicit contracts with mission-owned state instead
 * of ad-hoc debug events. The slice only orchestrates offer acceptance and UI
 * inbox refresh; the domain module owns stage progression rules.
 */
export const createMissionSlice: GameSlice<
  Pick<GameStore, 'acceptMission' | 'declineMission' | 'resolveMissionChoice' | 'dismissMissionMessage'>
> = (set) => ({
  acceptMission: (offerId) =>
    set((state) => {
      const offer = state.missions.availableContracts.find((entry) => entry.id === offerId);
      if (!offer) {
        return state;
      }
      const accepted = acceptMissionOffer(offer);
      const activeMissions = [...state.commander.activeMissions, accepted.mission];
      const missionCargo = [...state.commander.missionCargo, ...accepted.missionCargo];
      return {
        commander: {
          ...state.commander,
          activeMissions,
          missionCargo
        },
        missions: {
          availableContracts: state.missions.availableContracts.filter((entry) => entry.id !== offerId),
          activeMissionMessages: getMissionInbox(activeMissions, { currentSystem: state.universe.currentSystem })
        }
      };
    }),
  declineMission: (offerId) =>
    set((state) => ({
      missions: {
        ...state.missions,
        availableContracts: state.missions.availableContracts.filter((entry) => entry.id !== offerId)
      }
    })),
  resolveMissionChoice: (missionId, choiceId) =>
    set((state) => {
      const activeMissions = resolveMissionChoiceState(state.commander.activeMissions, missionId, choiceId);
      return {
        commander: {
          ...state.commander,
          activeMissions
        },
        missions: {
          ...state.missions,
          activeMissionMessages: getMissionInbox(activeMissions, { currentSystem: state.universe.currentSystem })
        }
      };
    }),
  dismissMissionMessage: (messageId) =>
    set((state) => {
      const activeMissions = dismissMissionMessageState(state.commander.activeMissions, messageId);
      return {
        commander: {
          ...state.commander,
          activeMissions
        },
        missions: {
          ...state.missions,
          activeMissionMessages: getMissionInbox(activeMissions, { currentSystem: state.universe.currentSystem }).filter((message) => message.id !== messageId)
        }
      };
    })
});

export function createInitialMissionState(currentSystem: string, nearbySystems: string[], stardate: number) {
  return {
    availableContracts: generateMissionOffers({ currentSystem, nearbySystems, stardate }),
    activeMissionMessages: []
  };
}
