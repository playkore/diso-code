import { describe, expect, it } from 'vitest';
import { createDefaultCommander } from '../commander';
import { canBuyEquipment, canBuyMissile, canInstallLaser, getAvailableEquipmentForSystem } from '../outfitting';

describe('outfitting rules', () => {
  it('starts new commanders with RPG HP progression and no retired shield upgrade', () => {
    const commander = createDefaultCommander();
    expect(commander.level).toBe(1);
    expect(commander.hp).toBe(60);
    expect(commander.attack).toBe(9);
    expect(commander.installedEquipment.shield_generator).toBe(false);
  });

  it('gates equipment by tech level and install state', () => {
    const commander = createDefaultCommander();
    commander.cash = 100000;
    const lowTechOffers = getAvailableEquipmentForSystem(2, commander);
    const highTechOffers = getAvailableEquipmentForSystem(10, commander);
    expect(lowTechOffers.find((offer) => offer.id === 'docking_computer')).toBeUndefined();
    expect(highTechOffers.find((offer) => offer.id === 'docking_computer')?.available).toBe(true);
    expect(highTechOffers.find((offer) => offer.id === 'shield_generator')).toBeUndefined();
  });

  it('enforces purchase and mount constraints for outfitting', () => {
    const commander = createDefaultCommander();
    commander.cash = 100000;
    expect(canBuyEquipment(commander, 2, 'ecm').ok).toBe(true);
    expect(canBuyEquipment(commander, 1, 'ecm').ok).toBe(false);
    expect(canBuyEquipment(commander, 10, 'shield_generator').ok).toBe(false);
    expect(canBuyEquipment(commander, 10, 'energy_box_2').ok).toBe(false);
    expect(canInstallLaser(commander, 4, 'rear', 'beam_laser').ok).toBe(true);
    expect(canInstallLaser(commander, 2, 'rear', 'beam_laser').ok).toBe(false);
    commander.cash = 2000;
    expect(canBuyMissile(commander, 1).ok).toBe(false);
  });
});
