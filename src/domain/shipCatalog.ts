export type ShipType = 'cobra_mk_iii';
export type LaserMountPosition = 'front' | 'rear' | 'left' | 'right';
export type LaserId = 'pulse_laser' | 'beam_laser' | 'military_laser' | 'mining_laser';
export type EquipmentId =
  | 'fuel_scoops'
  | 'ecm'
  | 'docking_computer'
  | 'extra_energy_unit'
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
  extra_energy_unit: {
    id: 'extra_energy_unit',
    name: 'Extra Energy Unit',
    price: 15000,
    requiredTechLevel: 9,
    description: 'Improves future energy recharge behavior.',
    affectsEnergyRecharge: true,
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
  'fuel_scoops',
  'ecm',
  'docking_computer',
  'extra_energy_unit',
  'large_cargo_bay',
  'escape_pod',
  'energy_bomb'
];
