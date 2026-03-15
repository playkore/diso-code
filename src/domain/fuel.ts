export const MAX_FUEL = 7;
export const FUEL_PRICE_PER_LIGHT_YEAR = 2;
export const FUEL_PRICE_PER_TENTH_LIGHT_YEAR_TENTHS_CREDITS = 2;

export function clampFuel(fuel: number): number {
  return Math.max(0, Math.min(MAX_FUEL, Math.round(fuel * 10) / 10));
}

export function fuelUnitsToLightYears(units: number): number {
  return clampFuel(units / 10);
}

export function getFuelUnits(fuel: number): number {
  return Math.max(0, Math.round(clampFuel(fuel) * 10));
}

export function getJumpFuelCost(distance: number): number {
  return Math.round(distance * 10) / 10;
}

export function getJumpFuelUnits(distance: number): number {
  return Math.max(0, Math.round(getJumpFuelCost(distance) * 10));
}

export function getRefuelCost(units: number): number {
  return Math.max(0, Math.trunc(units)) * FUEL_PRICE_PER_TENTH_LIGHT_YEAR_TENTHS_CREDITS;
}
