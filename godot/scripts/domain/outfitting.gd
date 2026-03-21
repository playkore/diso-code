extends RefCounted

const ShipCatalog = preload("res://scripts/domain/ship_catalog.gd")

## Outfitting helpers keep availability and pricing rules out of the UI layer.

static func get_free_cargo_space(commander: Dictionary) -> int:
	var cargo_total := 0
	for amount in commander.get("cargo", {}).values():
		cargo_total += maxi(0, int(amount))
	return maxi(0, int(commander.get("cargo_capacity", 0)) - cargo_total)

static func can_install_laser(commander: Dictionary, tech_level: int, mount: String, laser_id: String) -> Dictionary:
	var laser: Dictionary = ShipCatalog.LASER_CATALOG.get(laser_id, {})
	if tech_level < int(laser.get("required_tech_level", 99)):
		return {"ok": false, "reason": "Requires tech level %d." % int(laser.get("required_tech_level", 99))}
	if not Array(laser.get("mount_positions", [])).has(mount):
		return {"ok": false, "reason": "Laser cannot mount on that arc."}
	if int(commander.get("cash", 0)) < int(laser.get("price", 0)):
		return {"ok": false, "reason": "Insufficient credits."}
	if commander.get("laser_mounts", {}).get(mount, null) == laser_id:
		return {"ok": false, "reason": "Laser already installed on that mount."}
	return {"ok": true}

static func can_buy_equipment(commander: Dictionary, tech_level: int, equipment_id: String) -> Dictionary:
	var equipment: Dictionary = ShipCatalog.EQUIPMENT_CATALOG.get(equipment_id, {})
	if tech_level < int(equipment.get("required_tech_level", 99)):
		return {"ok": false, "reason": "Requires tech level %d." % int(equipment.get("required_tech_level", 99))}
	if bool(commander.get("installed_equipment", {}).get(equipment_id, false)):
		return {"ok": false, "reason": "Already installed."}
	if int(commander.get("cash", 0)) < int(equipment.get("price", 0)):
		return {"ok": false, "reason": "Insufficient credits."}
	return {"ok": true}

static func can_buy_missile(commander: Dictionary, tech_level: int) -> Dictionary:
	if tech_level < int(ShipCatalog.MISSILE_CATALOG.get("required_tech_level", 99)):
		return {"ok": false, "reason": "Requires tech level %d." % int(ShipCatalog.MISSILE_CATALOG.get("required_tech_level", 99))}
	if int(commander.get("missiles_installed", 0)) >= int(commander.get("missile_capacity", 0)):
		return {"ok": false, "reason": "Missile rack is full."}
	if int(commander.get("cash", 0)) < int(ShipCatalog.MISSILE_CATALOG.get("price", 0)):
		return {"ok": false, "reason": "Insufficient credits."}
	return {"ok": true}

static func get_available_equipment_for_system(tech_level: int, commander: Dictionary) -> Array:
	var offers: Array = []
	for equipment_id in ShipCatalog.EQUIPMENT_ORDER:
		var equipment: Dictionary = ShipCatalog.EQUIPMENT_CATALOG.get(equipment_id, {})
		if tech_level < int(equipment.get("required_tech_level", 99)):
			continue
		var result := can_buy_equipment(commander, tech_level, equipment_id)
		var offer := equipment.duplicate(true)
		offer["installed"] = bool(commander.get("installed_equipment", {}).get(equipment_id, false))
		offer["available"] = bool(result.get("ok", false))
		offer["reason"] = result.get("reason", "")
		offers.append(offer)
	return offers

static func get_laser_offers_for_system(tech_level: int, commander: Dictionary, mount: String) -> Array:
	var offers: Array = []
	for laser_id in ShipCatalog.LASER_ORDER:
		var laser: Dictionary = ShipCatalog.LASER_CATALOG.get(laser_id, {})
		if tech_level < int(laser.get("required_tech_level", 99)):
			continue
		var result := can_install_laser(commander, tech_level, mount, laser_id)
		var offer := laser.duplicate(true)
		offer["available"] = bool(result.get("ok", false))
		offer["reason"] = result.get("reason", "")
		offers.append(offer)
	return offers

static func get_installed_equipment_list(commander: Dictionary) -> Array:
	var names: Array = []
	for equipment_id in ShipCatalog.EQUIPMENT_ORDER:
		if bool(commander.get("installed_equipment", {}).get(equipment_id, false)):
			names.append(str(ShipCatalog.EQUIPMENT_CATALOG.get(equipment_id, {}).get("name", equipment_id)))
	return names
