extends RefCounted

## Mission progression helpers backed by the legacy-style TP bitfield.

const TP_MISSION_FLAGS := {
	"constrictorBriefed": 1 << 0,
	"constrictorCompleted": 1 << 1,
	"thargoidPlansBriefed": 1 << 2,
	"thargoidPlansCompleted": 1 << 3,
	"trumblesUnlocked": 1 << 4,
	"trumblesResolved": 1 << 5
}

static func has_mission_flag(tp: int, flag: String) -> bool:
	return (tp & int(TP_MISSION_FLAGS.get(flag, 0))) != 0

static func with_mission_flag(tp: int, flag: String) -> int:
	return tp | int(TP_MISSION_FLAGS.get(flag, 0))

static func _supports_constrictor(variant: String) -> bool:
	return variant == "classic"

static func _supports_trumbles(variant: String) -> bool:
	return variant == "c64" or variant == "nes"

static func get_mission_messages_for_docking(progress: Dictionary) -> Array:
	var next_tp := int(progress.get("tp", 0))
	var variant := str(progress.get("variant", "classic"))
	var messages: Array = []
	if _supports_constrictor(variant) and not has_mission_flag(next_tp, "constrictorBriefed"):
		messages.append({
			"id": "constrictor-briefing",
			"kind": "briefing",
			"title": "Navy Briefing: Constrictor",
			"body": "A prototype Constrictor has been stolen. Track and destroy the ship for a Navy reward."
		})
	if _supports_constrictor(variant) and has_mission_flag(next_tp, "constrictorCompleted") and not has_mission_flag(next_tp, "thargoidPlansBriefed"):
		messages.append({
			"id": "thargoid-plans-briefing",
			"kind": "briefing",
			"title": "Navy Briefing: Thargoid Plans",
			"body": "Deliver stolen Thargoid plans through hostile space to support naval defenses."
		})
	if _supports_trumbles(variant) and has_mission_flag(next_tp, "trumblesUnlocked"):
		messages.append({
			"id": "trumbles-debriefing",
			"kind": "debriefing",
			"title": "Station Advisory: Trumbles",
			"body": "Dock authorities report Trumble activity in cargo bays. Containment rewards are available."
		})
	if has_mission_flag(next_tp, "thargoidPlansCompleted"):
		messages.append({
			"id": "thargoid-plans-debriefing",
			"kind": "debriefing",
			"title": "Navy Debrief: Plans Delivered",
			"body": "Command confirms delivery. Your standing has improved and naval pay is credited."
		})
	return messages

static func apply_mission_external_event(progress: Dictionary, event: Dictionary) -> Dictionary:
	var tp := int(progress.get("tp", 0))
	var variant := str(progress.get("variant", "classic"))
	match str(event.get("type", "")):
		"travel:constrictor-zone-visited":
			if _supports_constrictor(variant):
				tp = with_mission_flag(tp, "constrictorBriefed")
		"combat:constrictor-destroyed":
			if _supports_constrictor(variant):
				tp = with_mission_flag(with_mission_flag(tp, "constrictorBriefed"), "constrictorCompleted")
		"travel:thargoid-contact-system":
			tp = with_mission_flag(tp, "thargoidPlansBriefed")
		"combat:thargoid-plans-delivered":
			tp = with_mission_flag(with_mission_flag(tp, "thargoidPlansBriefed"), "thargoidPlansCompleted")
		"economy:trumbles-purchased":
			if _supports_trumbles(variant):
				tp = with_mission_flag(tp, "trumblesUnlocked")
		"economy:trumbles-eradicated":
			if _supports_trumbles(variant):
				tp = with_mission_flag(with_mission_flag(tp, "trumblesUnlocked"), "trumblesResolved")
	return {
		"tp": tp,
		"variant": variant
	}

static func apply_docking_mission_state(progress: Dictionary) -> Dictionary:
	var tp := int(progress.get("tp", 0))
	var variant := str(progress.get("variant", "classic"))
	if _supports_constrictor(variant) and not has_mission_flag(tp, "constrictorBriefed"):
		tp = with_mission_flag(tp, "constrictorBriefed")
	if has_mission_flag(tp, "constrictorCompleted") and not has_mission_flag(tp, "thargoidPlansBriefed"):
		tp = with_mission_flag(tp, "thargoidPlansBriefed")
	return {
		"tp": tp,
		"variant": variant
	}
