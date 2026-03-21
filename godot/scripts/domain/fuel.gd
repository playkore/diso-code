extends RefCounted

const MAX_FUEL := 7.0
const FUEL_PRICE_PER_TENTH_LIGHT_YEAR_TENTHS_CREDITS := 2

static func clamp_fuel(fuel: float) -> float:
	return clamp(round(fuel * 10.0) / 10.0, 0.0, MAX_FUEL)

static func fuel_units_to_light_years(units: int) -> float:
	return clamp_fuel(float(units) / 10.0)

static func get_fuel_units(fuel: float) -> int:
	return maxi(0, int(round(clamp_fuel(fuel) * 10.0)))

static func get_jump_fuel_cost(distance: float) -> float:
	return round(distance * 10.0) / 10.0

static func get_jump_fuel_units(distance: float) -> int:
	return maxi(0, int(round(get_jump_fuel_cost(distance) * 10.0)))

static func get_refuel_cost(units: int) -> int:
	return maxi(0, units) * FUEL_PRICE_PER_TENTH_LIGHT_YEAR_TENTHS_CREDITS
