extends RefCounted

const SystemDataDomain = preload("res://scripts/domain/system_data.gd")
const UniverseDomain = preload("res://scripts/domain/universe.gd")

## Cached galaxy catalog for the first galaxy used by the current game.
##
## The cache avoids regenerating the full 256-system roster every time a screen
## needs nearby stars or system data while still preserving determinism.

static var _galaxy_one_systems: Array = []

static func _ensure_cache() -> void:
	if not _galaxy_one_systems.is_empty():
		return
	for system in UniverseDomain.generate_galaxy(0):
		_galaxy_one_systems.append({
			"index": system.get("index", 0),
			"seed": system.get("seed", {}).duplicate(true),
			"data": SystemDataDomain.generate_system_data(system.get("seed", {}))
		})

static func _chart_distance(a: Dictionary, b: Dictionary) -> float:
	return sqrt(pow(float(a.get("x", 0) - b.get("x", 0)), 2.0) + pow(float(a.get("y", 0) - b.get("y", 0)) / 2.0, 2.0))

static func get_galaxy_systems() -> Array:
	_ensure_cache()
	return _galaxy_one_systems

static func get_system_by_name(system_name: String) -> Dictionary:
	_ensure_cache()
	for system in _galaxy_one_systems:
		if str(system.get("data", {}).get("name", "")) == system_name:
			return system
	return {}

static func get_nearby_system_names(system_name: String, limit: int = 4) -> Array:
	var origin := get_system_by_name(system_name)
	if origin.is_empty():
		return []
	var systems := get_galaxy_systems().duplicate(true)
	systems = systems.filter(func(system: Dictionary) -> bool:
		return str(system.get("data", {}).get("name", "")) != system_name
	)
	systems.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		return _chart_distance(origin.get("data", {}), left.get("data", {})) < _chart_distance(origin.get("data", {}), right.get("data", {}))
	)
	var names: Array = []
	for index in range(min(limit, systems.size())):
		names.append(str(systems[index].get("data", {}).get("name", "")))
	return names

static func get_visible_systems(system_name: String, chart_radius_x: int = 26, chart_radius_y: int = 22) -> Array:
	var origin := get_system_by_name(system_name)
	if origin.is_empty():
		return []
	return get_galaxy_systems().filter(func(system: Dictionary) -> bool:
		var dx := int(system.get("data", {}).get("x", 0)) - int(origin.get("data", {}).get("x", 0))
		var dy := (int(system.get("data", {}).get("y", 0)) - int(origin.get("data", {}).get("y", 0))) / 2.0
		return abs(dx) <= chart_radius_x and abs(dy) <= chart_radius_y
	)

static func get_system_distance(system_name: String, target_system_name: String) -> float:
	var origin := get_system_by_name(system_name)
	var target := get_system_by_name(target_system_name)
	if origin.is_empty() or target.is_empty():
		return INF
	return _chart_distance(origin.get("data", {}), target.get("data", {})) * 0.4
