import { canBuyEquipment, canBuyMissile, canInstallLaser } from '../../domain/outfitting';
import { EQUIPMENT_CATALOG, LASER_CATALOG, MISSILE_CATALOG } from '../../domain/shipCatalog';
import { normalizeCommanderState } from '../../domain/commander';
import { formatCredits } from '../../utils/money';
import { createUiMessage, withUiMessage } from '../uiMessages';
import { getCurrentTechLevel } from '../gameStateFactory';
import type { GameSlice, GameStore } from '../storeTypes';

export const createOutfittingSlice: GameSlice<Pick<GameStore, 'buyEquipment' | 'buyLaser' | 'buyMissile'>> = (set) => ({
  buyEquipment: (equipmentId) =>
    set((state) => {
      const techLevel = getCurrentTechLevel(state.universe.currentSystem);
      const equipment = EQUIPMENT_CATALOG[equipmentId];
      const check = canBuyEquipment(state.commander, techLevel, equipmentId);
      if (!check.ok) {
        return {
          ui: withUiMessage(state.ui, createUiMessage('error', `Cannot buy ${equipment.name}`, check.reason ?? 'The outfitting terminal rejected the order.'))
        };
      }
      // Equipment purchases can affect derived commander fields such as cargo
      // capacity, so the result is always re-normalized before storing it.
      const nextCommander = normalizeCommanderState({
        ...state.commander,
        cash: state.commander.cash - equipment.price,
        energyBanks: equipment.setsEnergyBanksTo ?? state.commander.energyBanks,
        cargoCapacity: equipment.expandsCargoBayTo ?? state.commander.cargoCapacity,
        installedEquipment: {
          ...state.commander.installedEquipment,
          [equipmentId]: true
        }
      });
      return {
        commander: nextCommander,
        ui: withUiMessage(
          state.ui,
          createUiMessage('success', `${equipment.name} installed`, `Spent ${formatCredits(equipment.price)}. Balance now ${formatCredits(nextCommander.cash)}.`)
        )
      };
    }),
  buyLaser: (mount, laserId) =>
    set((state) => {
      const techLevel = getCurrentTechLevel(state.universe.currentSystem);
      const laser = LASER_CATALOG[laserId];
      const check = canInstallLaser(state.commander, techLevel, mount, laserId);
      if (!check.ok) {
        return {
          ui: withUiMessage(state.ui, createUiMessage('error', `Cannot install ${laser.name}`, check.reason ?? 'The mount rejected the fit.'))
        };
      }
      const previous = state.commander.laserMounts[mount];
      // Laser fitting only changes a single mount, but normalization keeps the
      // commander shape consistent with any future compatibility rules.
      const nextCommander = normalizeCommanderState({
        ...state.commander,
        cash: state.commander.cash - laser.price,
        laserMounts: {
          ...state.commander.laserMounts,
          [mount]: laserId
        }
      });
      const previousText = previous ? ` Replaced ${LASER_CATALOG[previous].name}.` : '';
      return {
        commander: nextCommander,
        ui: withUiMessage(
          state.ui,
          createUiMessage('success', `${laser.name} fitted`, `Spent ${formatCredits(laser.price)} on the ${mount} mount.${previousText} Balance ${formatCredits(nextCommander.cash)}.`)
        )
      };
    }),
  buyMissile: () =>
    set((state) => {
      const techLevel = getCurrentTechLevel(state.universe.currentSystem);
      const check = canBuyMissile(state.commander, techLevel);
      if (!check.ok) {
        return {
          ui: withUiMessage(state.ui, createUiMessage('error', 'Cannot buy missile', check.reason ?? 'The rack cannot accept another missile.'))
        };
      }
      // Missiles consume rack capacity rather than a named equipment flag, so
      // they use their own purchase path even though the UX is similar.
      const nextCommander = normalizeCommanderState({
        ...state.commander,
        cash: state.commander.cash - MISSILE_CATALOG.price,
        missilesInstalled: state.commander.missilesInstalled + MISSILE_CATALOG.capacityUse
      });
      return {
        commander: nextCommander,
        ui: withUiMessage(
          state.ui,
          createUiMessage('success', 'Missile loaded', `Spent ${formatCredits(MISSILE_CATALOG.price)}. Rack now ${nextCommander.missilesInstalled}/${nextCommander.missileCapacity}.`)
        )
      };
    })
});
