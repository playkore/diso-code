extends RefCounted

# Shared integer helpers for the ported simulation code.
#
# The classic economy and universe logic relies on byte-sized wraparound
# semantics. Keeping those conversions in one place makes the other domain
# modules easier to read and keeps the 8-bit / 16-bit rules consistent.
class_name DomainFixedWidth


static func u8(value: int) -> int:
	return value & 0xFF


static func u16(value: int) -> int:
	return value & 0xFFFF


static func rotl8(value: int) -> int:
	var byte := u8(value)
	return u8((byte << 1) | (byte >> 7))


static func add_u16(left: int, right: int) -> int:
	return u16(left + right)


static func sub_u16(left: int, right: int) -> int:
	return u16(left - right)
