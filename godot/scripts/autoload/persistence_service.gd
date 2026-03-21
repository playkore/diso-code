extends Node

## Save-file builder and loader for the Godot rewrite.
##
## The web build stored three slots in local storage. Godot uses `user://`
## instead, but keeps the same conceptual layout: versioned snapshots with a
## checksum so corrupt files fail closed rather than half-loading.

const GAME_SAVE_SCHEMA_VERSION := 1
const SAVE_SLOT_IDS := [1, 2, 3]

func _ready() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://saves"))

func get_save_slot_path(slot_id: int) -> String:
	return "user://saves/slot_%d.json" % slot_id

func fnv1a32(input: String) -> int:
	var hash: int = 0x811C9DC5
	for codepoint in input.to_utf8_buffer():
		hash = hash ^ int(codepoint)
		hash = int((hash * 0x01000193) & 0xFFFFFFFF)
	return hash & 0xFFFFFFFF

func build_game_save(snapshot: Dictionary, saved_at: String = "") -> Dictionary:
	var timestamp := saved_at if saved_at != "" else Time.get_datetime_string_from_system(true)
	var snapshot_json := JSON.stringify(snapshot)
	return {
		"version": GAME_SAVE_SCHEMA_VERSION,
		"checksum": fnv1a32("%d:%s:%s" % [GAME_SAVE_SCHEMA_VERSION, timestamp, snapshot_json]),
		"saved_at": timestamp,
		"snapshot": snapshot
	}

func serialize_game_json(snapshot: Dictionary, saved_at: String = "") -> String:
	return JSON.stringify(build_game_save(snapshot, saved_at), "\t")

func load_game_json(json_text: String) -> Dictionary:
	var parsed: Variant = JSON.parse_string(json_text)
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("Save data is not a dictionary payload.")
		return {}
	var save_file: Dictionary = parsed
	if int(save_file.get("version", -1)) != GAME_SAVE_SCHEMA_VERSION:
		push_error("Unsupported Godot save schema version: %s" % [save_file.get("version", "missing")])
		return {}
	var expected_checksum := build_game_save(save_file.get("snapshot", {}), str(save_file.get("saved_at", ""))).get("checksum", -1)
	if int(save_file.get("checksum", -2)) != int(expected_checksum):
		push_error("Save checksum mismatch.")
		return {}
	return save_file

func save_slot(slot_id: int, snapshot: Dictionary) -> Dictionary:
	var saved_at := Time.get_datetime_string_from_system(true)
	var payload := build_game_save(snapshot, saved_at)
	var file := FileAccess.open(get_save_slot_path(slot_id), FileAccess.WRITE)
	if file == null:
		push_error("Failed to open save slot %d for writing." % slot_id)
		return {}
	file.store_string(JSON.stringify(payload, "\t"))
	file.close()
	return payload

func load_slot(slot_id: int) -> Dictionary:
	var path := get_save_slot_path(slot_id)
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		push_error("Failed to open save slot %d for reading." % slot_id)
		return {}
	var text := file.get_as_text()
	file.close()
	return load_game_json(text)

func load_all_slots() -> Dictionary:
	var slots := {}
	for slot_id in SAVE_SLOT_IDS:
		var payload := load_slot(slot_id)
		if payload.is_empty():
			continue
		slots[slot_id] = payload
	return slots
