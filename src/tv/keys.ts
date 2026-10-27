export const KEY_CODES = {
  SEEK_FWD: [2, 0], SEEK_BACK: [2, 1], PAUSE: [2, 2], PLAY: [2, 3],
  DOWN: [3, 0], LEFT: [3, 1], OK: [3, 2], RIGHT: [3, 7], UP: [3, 8],
  BACK: [4, 0], CC_TOGGLE: [4, 4], HOME: [4, 15], INFO: [4, 6], MENU: [4, 8],
  VOL_DOWN: [5, 0], VOL_UP: [5, 1], MUTE_TOGGLE: [5, 4], PIC_MODE: [6, 0],
  INPUT_NEXT: [7, 1], CH_DOWN: [8, 0], CH_UP: [8, 1], CH_PREV: [8, 2], EXIT: [9, 0],
  POWER_OFF: [11, 0], POWER_ON: [11, 1], POWER_TOGGLE: [11, 2],
} as const satisfies Record<string, readonly [number, number]>;
export type KeyName = keyof typeof KEY_CODES;
