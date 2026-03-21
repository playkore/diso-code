extends RefCounted

const SystemNameDomain = preload("res://scripts/domain/system_name.gd")

## Builds system metadata from a procedural seed.
##
## The Godot port keeps the generated values in dictionaries because those map
## cleanly to save files, UI rendering, and future parity fixtures.

const SPECIES_SIZE := ["Large", "Fierce", "Small"]
const SPECIES_COLOR := ["Green", "Red", "Yellow", "Blue", "Black", "Harmless"]
const SPECIES_FEATURE := ["Slimy", "Bug-Eyed", "Horned", "Bony", "Fat", "Furry"]
const SPECIES_TYPE := ["Rodent", "Frog", "Lizard", "Lobster", "Bird", "Humanoid", "Feline", "Insect"]

static func _to_title_case(value: String) -> String:
	var lower: String = value.to_lower()
	if lower.is_empty():
		return lower
	return lower[0].to_upper() + lower.substr(1)

static func _build_species(seed: Dictionary) -> String:
	if (int(seed.get("w2", 0)) & 0x80) == 0:
		return "Human Colonials"
	var size: String = str(SPECIES_SIZE[((int(seed.get("w2", 0)) >> 10) & 0x03) % SPECIES_SIZE.size()])
	var color: String = str(SPECIES_COLOR[((int(seed.get("w2", 0)) >> 13) & 0x07) % SPECIES_COLOR.size()])
	var feature: String = str(SPECIES_FEATURE[((int(seed.get("w0", 0)) >> 8) & 0x07) % SPECIES_FEATURE.size()])
	var species_type: String = str(SPECIES_TYPE[((int(seed.get("w1", 0)) >> 8) & 0x07) % SPECIES_TYPE.size()])
	return ("%s %s %s %ss" % [size, color, feature, species_type]).strip_edges()

static func generate_system_data(seed: Dictionary) -> Dictionary:
	var government: int = (int(seed.get("w1", 0)) >> 3) & 0x07
	var economy: int = (int(seed.get("w0", 0)) >> 8) & 0x07
	if government <= 1:
		economy = economy | 0x02
	var tech_level: int = (economy ^ 0x07) + ((int(seed.get("w1", 0)) >> 8) & 0x03)
	tech_level += government >> 1
	if (government & 0x01) == 1:
		tech_level += 1
	var population: int = 4 * tech_level + economy + government + 1
	var productivity: int = ((economy ^ 0x07) + 3) * (government + 4) * population * 8
	var radius: int = 256 * (((int(seed.get("w2", 0)) >> 8) & 0x0F) + 11) + ((int(seed.get("w0", 0)) >> 8) & 0xFF)
	return {
		"name": _to_title_case(SystemNameDomain.generate_system_name(seed)),
		"x": int(seed.get("w1", 0)) >> 8,
		"y": int(seed.get("w0", 0)) >> 8,
		"economy": economy,
		"government": government,
		"tech_level": tech_level,
		"population": population,
		"productivity": productivity,
		"radius": radius,
		"species": _build_species(seed)
	}
