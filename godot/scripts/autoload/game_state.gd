extends Node

## Global store for the Godot rewrite.
##
## This singleton mirrors the role of the Zustand root store in the web app:
## it owns the canonical run state, exposes lightweight UI preferences, and
## broadcasts change notifications so scenes can re-render from a single source
## of truth instead of caching detached copies.

signal changed(section: StringName)

const TAB_MARKET := "market"
const TAB_EQUIPMENT := "equipment"
const TAB_INVENTORY := "inventory"
const TAB_SYSTEM_DATA := "system-data"
const TAB_STAR_MAP := "star-map"
const TAB_MISSIONS := "missions"
const TAB_SAVE_LOAD := "save-load"
const TAB_TRAVEL := "travel"

var universe: Dictionary = {}
var commander: Dictionary = {}
var market: Dictionary = {}
var missions: Dictionary = {}
var travel_session: Dictionary = {}
var save_states: Dictionary = {}
var ui: Dictionary = {}

func set_full_state(next_state: Dictionary) -> void:
	# Full-state replacement is used during startup, new-game creation, and save
	# loading so every subsystem returns to a known consistent snapshot.
	universe = next_state.get("universe", {}).duplicate(true)
	commander = next_state.get("commander", {}).duplicate(true)
	market = next_state.get("market", {}).duplicate(true)
	missions = next_state.get("missions", {}).duplicate(true)
	travel_session = next_state.get("travel_session", {}).duplicate(true)
	save_states = next_state.get("save_states", {}).duplicate(true)
	ui = next_state.get("ui", {}).duplicate(true)
	emit_signal("changed", &"all")

func mutate_section(section: StringName, value: Variant) -> void:
	match section:
		&"universe":
			universe = value
		&"commander":
			commander = value
		&"market":
			market = value
		&"missions":
			missions = value
		&"travel_session":
			travel_session = value
		&"save_states":
			save_states = value
		&"ui":
			ui = value
	emit_signal("changed", section)

func push_message(tone: String, title: String, body: String) -> void:
	var entry := {
		"id": "%s:%s" % [title, Time.get_datetime_string_from_system(true)],
		"tone": tone,
		"title": title,
		"body": body
	}
	var next_ui := ui.duplicate(true)
	var activity_log: Array = next_ui.get("activity_log", [])
	activity_log.push_front(entry)
	next_ui["latest_event"] = entry
	next_ui["activity_log"] = activity_log
	ui = next_ui
	emit_signal("changed", &"ui")
