extends Object
class_name StateBridge

const GAME_STATE_PATH := "/root/GameState"
const GAME_ACTIONS_PATH := "/root/GameActions"

static func _tree() -> SceneTree:
	return Engine.get_main_loop() as SceneTree

static func get_game_state_node() -> Node:
	var tree := _tree()
	if tree == null:
		return null
	return tree.root.get_node_or_null(GAME_STATE_PATH)

static func get_game_actions_node() -> Node:
	var tree := _tree()
	if tree == null:
		return null
	return tree.root.get_node_or_null(GAME_ACTIONS_PATH)

static func read_value(source: Variant, key: StringName, fallback: Variant = null) -> Variant:
	if source == null:
		return fallback
	if source is Dictionary:
		return source.get(key, fallback)
	if source is Object:
		var value := source.get(key)
		if value == null:
			return fallback
		return value
	return fallback

static func read_any(source: Variant, keys: Array, fallback: Variant = null) -> Variant:
	for key in keys:
		var value := read_value(source, StringName(key), null)
		if value != null:
			return value
	return fallback

static func read_path(source: Variant, path: Array[StringName], fallback: Variant = null) -> Variant:
	var current := source
	for part in path:
		current = read_value(current, part, null)
		if current == null:
			return fallback
	return current

static func collect_snapshot() -> Dictionary:
	var state := get_game_state_node()
	if state == null:
		return {}
	return {
		"commander": read_value(state, &"commander", null),
		"universe": read_value(state, &"universe", null),
		"market": read_value(state, &"market", null),
		"missions": read_value(state, &"missions", null),
		"travel_session": read_value(state, &"travel_session", null),
		"save_states": read_value(state, &"save_states", null),
		"ui": read_value(state, &"ui", null)
	}

static func call_action(method_name: StringName, args: Array = []) -> bool:
	var actions := get_game_actions_node()
	if actions == null or not actions.has_method(method_name):
		return false
	actions.callv(method_name, args)
	return true
