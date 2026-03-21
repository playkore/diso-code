import { describe, expect, it } from 'vitest';
import { createDefaultCommander } from '../commander';
import { canBuyEquipment, canBuyMissile, canInstallLaser, getAvailableEquipmentForSystem } from '../outfitting';

describe('outfitting rules', () => {
  it('gates equipment by tech level and install state', () => {
    const commander = createDefaultCommander();
    commander.cash = 20000;
    const lowTechOffers = getAvailableEquipmentForSystem(2, commander);
    const highTechOffers = getAvailableEquipmentForSystem(10, commander);
    expect(lowTechOffers.find((offer) => offer.id === 'docking_computer')).toBeUndefined();
    expect(highTechOffers.find((offer) => offer.id === 'docking_computer')?.available).toBe(true);
  });

  it('enforces purchase and mount constraints for outfitting', () => {
    const commander = createDefaultCommander();
    commander.cash = 20000;
    expect(canBuyEquipment(commander, 2, 'ecm').ok).toBe(true);
    expect(canBuyEquipment(commander, 1, 'ecm').ok).toBe(false);
    expect(canInstallLaser(commander, 4, 'rear', 'beam_laser').ok).toBe(true);
    expect(canInstallLaser(commander, 2, 'rear', 'beam_laser').ok).toBe(false);
    commander.cash = 2000;
    expect(canBuyMissile(commander, 1).ok).toBe(false);
  });
});
