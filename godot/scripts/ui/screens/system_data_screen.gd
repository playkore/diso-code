extends UIScreenBase

const GalaxyCatalog = preload("res://scripts/domain/galaxy_catalog.gd")

const ECONOMY_LABELS := [
	"Rich Industrial",
	"Average Industrial",
	"Poor Industrial",
	"Mainly Industrial",
	"Mainly Agricultural",
	"Rich Agricultural",
	"Average Agricultural",
	"Poor Agricultural"
]

const GOVERNMENT_LABELS := [
	"Anarchy",
	"Feudal",
	"Multi-Government",
	"Dictatorship",
	"Communist",
	"Confederacy",
	"Democracy",
	"Corporate State"
]

func _init() -> void:
	screen_title = "System Data"
	screen_subtitle = "Procedural system metadata, chart position, and local species notes."
	empty_message = "System data will be synthesized from the current system entry when the autoload exists."

func _populate_body() -> void:
	var snapshot: Dictionary = get_state_snapshot()
	var universe: Variant = snapshot.get("universe", null)
	var current_system_name: String = str(StateBridge.read_any(universe, ["current_system", "currentSystem"], "Lave"))
	var system: Dictionary = GalaxyCatalog.get_system_by_name(current_system_name).get("data", {})

	var economy: int = int(StateBridge.read_any(system, ["economy"], 0))
	var government: int = int(StateBridge.read_any(system, ["government"], 0))

	add_section_title("Local System")
	add_detail_row("Name", str(StateBridge.read_any(system, ["name"], StateBridge.read_any(universe, ["current_system", "currentSystem"], "Unknown"))))
	add_detail_row("Economy", ECONOMY_LABELS[economy] if economy >= 0 and economy < ECONOMY_LABELS.size() else "Unknown")
	add_detail_row("Government", GOVERNMENT_LABELS[government] if government >= 0 and government < GOVERNMENT_LABELS.size() else "Unknown")
	add_detail_row("Tech Level", str(StateBridge.read_any(system, ["tech_level", "techLevel"], "-")))
	add_detail_row("Population", str(StateBridge.read_any(system, ["population"], "-")))
	add_detail_row("Productivity", "%s M CR" % str(StateBridge.read_any(system, ["productivity"], "-")))
	add_detail_row("Radius", "%s km" % str(StateBridge.read_any(system, ["radius"], "-")))
	add_detail_row("Species", str(StateBridge.read_any(system, ["species"], "Unknown")))
	add_detail_row("Chart Position", "%s, %s" % [
		str(StateBridge.read_any(system, ["x"], "-")),
		str(int(StateBridge.read_any(system, ["y"], 0)) / 2)
	])
