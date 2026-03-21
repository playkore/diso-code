import { applyMissionExternalEvent, getMissionMessagesForDocking } from '../../domain/missions';
import type { GameSlice, GameStore } from '../storeTypes';

export const createMissionSlice: GameSlice<Pick<GameStore, 'triggerMissionExternalEvent'>> = (set) => ({
  triggerMissionExternalEvent: (event) =>
    set((state) => {
      const progress = applyMissionExternalEvent({ tp: state.commander.missionTP, variant: state.commander.missionVariant }, event);
      return {
        commander: {
          ...state.commander,
          missionTP: progress.tp
        },
        missions: {
          missionLog: getMissionMessagesForDocking(progress)
        }
      };
    })
});
