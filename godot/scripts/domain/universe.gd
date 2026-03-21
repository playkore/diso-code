extends RefCounted

## Procedural galaxy seed helpers.
##
## These functions preserve the same wraparound arithmetic used in the web app
## so system ordering and downstream generated metadata stay stable between
## implementations.

const BASE_SEED := {
	"w0": 0x5A4A,
	"w1": 0x0248,
	"w2": 0xB753
}

const WORD_MASK := 0xFFFF

static func advance_seed(seed: Dictionary) -> Dictionary:
	var next := (int(seed.get("w0", 0)) + int(seed.get("w1", 0)) + int(seed.get("w2", 0))) & WORD_MASK
	return {
		"w0": int(seed.get("w1", 0)),
		"w1": int(seed.get("w2", 0)),
		"w2": next
	}

static func _rotate_word_bytes_left(word: int) -> int:
	var low_byte := word & 0xFF
	var high_byte := (word >> 8) & 0xFF
	var rotated_low := ((low_byte << 1) & 0xFF) | (low_byte >> 7)
	var rotated_high := ((high_byte << 1) & 0xFF) | (high_byte >> 7)
	return ((rotated_high << 8) | rotated_low) & WORD_MASK

static func transform_galaxy(seed: Dictionary) -> Dictionary:
	return {
		"w0": _rotate_word_bytes_left(int(seed.get("w0", 0))),
		"w1": _rotate_word_bytes_left(int(seed.get("w1", 0))),
		"w2": _rotate_word_bytes_left(int(seed.get("w2", 0)))
	}

static func generate_galaxy_seed(galaxy_index: int) -> Dictionary:
	var turns := maxi(0, galaxy_index)
	var seed := BASE_SEED.duplicate(true)
	for _index in range(turns):
		seed = transform_galaxy(seed)
	return seed

static func generate_galaxy(galaxy_index: int) -> Array:
	var systems: Array = []
	var seed := generate_galaxy_seed(galaxy_index)
	for index in range(256):
		systems.append({
			"index": index,
			"seed": seed.duplicate(true)
		})
		for _step in range(4):
			seed = advance_seed(seed)
	return systems
