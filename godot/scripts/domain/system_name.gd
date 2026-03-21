extends RefCounted

const UniverseDomain = preload("res://scripts/domain/universe.gd")

## Generates classic-style system names from the procedural seed.

const DIGRAMS := [
	"AL", "LE", "XE", "GE", "ZA", "CE", "BI", "SO",
	"US", "ES", "AR", "MA", "IN", "DI", "RE", "A",
	"ER", "AT", "EN", "BE", "RA", "LA", "VE", "TI",
	"ED", "OR", "QU", "AN", "TE", "IS", "RI", "ON"
]

static func generate_system_name(seed: Dictionary) -> String:
	var local_seed := seed.duplicate(true)
	var output := ""
	var pair_count := 4 if (int(local_seed.get("w0", 0)) & 0x40) != 0 else 3
	for _index in range(pair_count):
		var pair_index := (int(local_seed.get("w2", 0)) >> 8) & 0x1F
		if pair_index != 0:
			output += str(DIGRAMS[pair_index])
		local_seed = UniverseDomain.advance_seed(local_seed)
	return output
