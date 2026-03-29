export type ShipType = 'cobra_mk_iii';
export type LaserMountPosition = 'front' | 'rear' | 'left' | 'right';
export type LaserId = 'pulse_laser' | 'beam_laser' | 'military_laser' | 'mining_laser';
export type EquipmentId =
  | 'shield_generator'
  | 'fuel_scoops'
  | 'ecm'
  | 'docking_computer'
  | 'galactic_hyperdrive'
  | 'extra_energy_unit'
  | 'energy_box_2'
  | 'energy_box_3'
  | 'energy_box_4'
  | 'large_cargo_bay'
  | 'escape_pod'
  | 'energy_bomb';
export type FireMode = 'pulse' | 'beam' | 'continuous';
export type Tier = 'low' | 'medium' | 'high' | 'special';

export interface PlayerShipDefinition {
  id: ShipType;
  name: string;
  manufacturer: string;
  basePrice: number;
  baseCargoCapacity: number;
  maxCargoCapacity: number;
  energyBanks: number;
  energyPerBank: number;
  missileCapacity: number;
  maxFuel: number;
  maxSpeed: string;
  maneuverability: string;
  defaultLasers: Record<LaserMountPosition, LaserId | null>;
}

export interface LaserDefinition {
  id: LaserId;
  name: string;
  price: number;
  requiredTechLevel: number;
  damageTier: Tier;
  energyUseTier: Exclude<Tier, 'special'>;
  fireMode: FireMode;
  mountPositions: LaserMountPosition[];
  description: string;
}

export interface EquipmentDefinition {
  id: EquipmentId;
  name: string;
  price: number;
  requiredTechLevel: number;
  description: string;
  setsEnergyBanksTo?: number;
  enablesShield?: boolean;
  affectsEnergyRecharge?: boolean;
  enablesAutoDock?: boolean;
  enablesFuelScooping?: boolean;
  expandsCargoBayTo?: number;
  unique: true;
}

export interface MissileDefinition {
  name: string;
  price: number;
  requiredTechLevel: number;
  capacityUse: number;
}

export const PLAYER_SHIP: PlayerShipDefinition = {
  id: 'cobra_mk_iii',
  name: 'Cobra Mk III',
  manufacturer: 'Cowell & MgRath',
  basePrice: 100000,
  baseCargoCapacity: 20,
  maxCargoCapacity: 35,
  energyBanks: 4,
  energyPerBank: 64,
  missileCapacity: 4,
  maxFuel: 7,
  maxSpeed: '0.35 LM',
  maneuverability: 'Medium',
  defaultLasers: {
    front: 'pulse_laser',
    rear: null,
    left: null,
    right: null
  }
};

export const LASER_CATALOG: Record<LaserId, LaserDefinition> = {
  pulse_laser: {
    id: 'pulse_laser',
    name: 'Pulse Laser',
    price: 4000,
    requiredTechLevel: 3,
    damageTier: 'low',
    energyUseTier: 'low',
    fireMode: 'pulse',
    mountPositions: ['front', 'rear', 'left', 'right'],
    description: 'Rapid starter laser with low draw and low damage.'
  },
  beam_laser: {
    id: 'beam_laser',
    name: 'Beam Laser',
    price: 10000,
    requiredTechLevel: 4,
    damageTier: 'medium',
    energyUseTier: 'medium',
    fireMode: 'continuous',
    mountPositions: ['front', 'rear', 'left', 'right'],
    description: 'Balanced sustained beam for general combat.'
  },
  military_laser: {
    id: 'military_laser',
    name: 'Military Laser',
    price: 60000,
    requiredTechLevel: 10,
    damageTier: 'high',
    energyUseTier: 'high',
    fireMode: 'continuous',
    mountPositions: ['front', 'rear', 'left', 'right'],
    description: 'Highest-output combat laser available to civilians.'
  },
  mining_laser: {
    id: 'mining_laser',
    name: 'Mining Laser',
    price: 8000,
    requiredTechLevel: 4,
    damageTier: 'special',
    energyUseTier: 'high',
    fireMode: 'beam',
    mountPositions: ['front', 'rear', 'left', 'right'],
    description: 'Heavy beam tuned for breaking asteroids into fragments.'
  }
};

export const EQUIPMENT_CATALOG: Record<EquipmentId, EquipmentDefinition> = {
  shield_generator: {
    id: 'shield_generator',
    name: 'Shield',
    price: 8000,
    requiredTechLevel: 10,
    description: 'Installs the ship shield generator and restores the classic defensive buffer.',
    enablesShield: true,
    unique: true
  },
  fuel_scoops: {
    id: 'fuel_scoops',
    name: 'Fuel Scoops',
    price: 5250,
    requiredTechLevel: 5,
    description: 'Lets the ship skim stars and cargo for fuel and salvage in future flight systems.',
    enablesFuelScooping: true,
    unique: true
  },
  ecm: {
    id: 'ecm',
    name: 'E.C.M. System',
    price: 6000,
    requiredTechLevel: 2,
    description: 'Electronic countermeasures for hostile missile defense.',
    unique: true
  },
  docking_computer: {
    id: 'docking_computer',
    name: 'Docking Computer',
    price: 15000,
    requiredTechLevel: 9,
    description: 'Automates docking procedures when station flight is available.',
    enablesAutoDock: true,
    unique: true
  },
  galactic_hyperdrive: {
    id: 'galactic_hyperdrive',
    name: 'Galactic Hyperdrive',
    price: 5000,
    requiredTechLevel: 10,
    description: 'Single-use drive that shifts the commander to the next galaxy while docked.',
    unique: true
  },
  extra_energy_unit: {
    id: 'extra_energy_unit',
    name: 'Extra Energy Unit',
    price: 15000,
    requiredTechLevel: 9,
    description: 'Improves future energy recharge behavior.',
    affectsEnergyRecharge: true,
    unique: true
  },
  energy_box_2: {
    id: 'energy_box_2',
    name: 'Energy Box 2',
    price: 10000,
    requiredTechLevel: 10,
    description: 'Adds the second energy box to the Cobra power reserve.',
    setsEnergyBanksTo: 2,
    unique: true
  },
  energy_box_3: {
    id: 'energy_box_3',
    name: 'Energy Box 3',
    price: 20000,
    requiredTechLevel: 10,
    description: 'Adds the third energy box once the second bank is already fitted.',
    setsEnergyBanksTo: 3,
    unique: true
  },
  energy_box_4: {
    id: 'energy_box_4',
    name: 'Energy Box 4',
    price: 40000,
    requiredTechLevel: 10,
    description: 'Adds the fourth and final energy box for the full Cobra reserve.',
    setsEnergyBanksTo: 4,
    unique: true
  },
  large_cargo_bay: {
    id: 'large_cargo_bay',
    name: 'Large Cargo Bay',
    price: 4000,
    requiredTechLevel: 3,
    description: 'Extends the Cobra hold from 20t to 35t.',
    expandsCargoBayTo: 35,
    unique: true
  },
  escape_pod: {
    id: 'escape_pod',
    name: 'Escape Pod',
    price: 10000,
    requiredTechLevel: 6,
    description: 'Life pod for commander survival and insurance hooks.',
    unique: true
  },
  energy_bomb: {
    id: 'energy_bomb',
    name: 'Energy Bomb',
    price: 9000,
    requiredTechLevel: 7,
    description: 'Single-use area weapon for future combat systems.',
    unique: true
  }
};

export const MISSILE_CATALOG: MissileDefinition = {
  name: 'Missile',
  price: 3000,
  requiredTechLevel: 1,
  capacityUse: 1
};

export const LASER_ORDER: LaserId[] = ['pulse_laser', 'beam_laser', 'mining_laser', 'military_laser'];
export const EQUIPMENT_ORDER: EquipmentId[] = [
  'shield_generator',
  'fuel_scoops',
  'ecm',
  'docking_computer',
  'galactic_hyperdrive',
  'extra_energy_unit',
  'energy_box_2',
  'energy_box_3',
  'energy_box_4',
  'large_cargo_bay',
  'escape_pod',
  'energy_bomb'
];
