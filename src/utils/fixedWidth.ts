const U8_MASK = 0xff;
const U16_MASK = 0xffff;

export const u8 = (value: number): number => value & U8_MASK;

export const u16 = (value: number): number => value & U16_MASK;

export const rotl8 = (value: number, shift: number): number => {
  const normalized = shift & 7;
  const byte = u8(value);
  return u8((byte << normalized) | (byte >>> (8 - normalized)));
};

export const addWrap8 = (a: number, b: number): number => u8(a + b);

export const subWrap8 = (a: number, b: number): number => u8(a - b);

export const addWrap16 = (a: number, b: number): number => u16(a + b);

export const subWrap16 = (a: number, b: number): number => u16(a - b);
