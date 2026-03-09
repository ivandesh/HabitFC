import type { Position } from '../types'

export interface FormationSlot {
  pos: Position
  x: number  // % from left
  y: number  // % from top
}

export interface FormationDef {
  label: string
  slots: FormationSlot[]
}

export const FORMATIONS: Record<string, FormationDef> = {
  '4-3-3': {
    label: '4–3–3',
    slots: [
      { pos: 'GK',  x: 50, y: 86 },
      { pos: 'DEF', x: 17, y: 70 }, { pos: 'DEF', x: 37, y: 70 },
      { pos: 'DEF', x: 63, y: 70 }, { pos: 'DEF', x: 83, y: 70 },
      { pos: 'MID', x: 22, y: 51 }, { pos: 'MID', x: 50, y: 46 }, { pos: 'MID', x: 78, y: 51 },
      { pos: 'FWD', x: 18, y: 27 }, { pos: 'FWD', x: 50, y: 18 }, { pos: 'FWD', x: 82, y: 27 },
    ],
  },
  '4-4-2': {
    label: '4–4–2',
    slots: [
      { pos: 'GK',  x: 50, y: 86 },
      { pos: 'DEF', x: 17, y: 70 }, { pos: 'DEF', x: 37, y: 70 },
      { pos: 'DEF', x: 63, y: 70 }, { pos: 'DEF', x: 83, y: 70 },
      { pos: 'MID', x: 15, y: 50 }, { pos: 'MID', x: 38, y: 50 },
      { pos: 'MID', x: 62, y: 50 }, { pos: 'MID', x: 85, y: 50 },
      { pos: 'FWD', x: 35, y: 22 }, { pos: 'FWD', x: 65, y: 22 },
    ],
  },
  '3-5-2': {
    label: '3–5–2',
    slots: [
      { pos: 'GK',  x: 50, y: 86 },
      { pos: 'DEF', x: 25, y: 70 }, { pos: 'DEF', x: 50, y: 70 }, { pos: 'DEF', x: 75, y: 70 },
      { pos: 'MID', x: 10, y: 50 }, { pos: 'MID', x: 28, y: 50 },
      { pos: 'MID', x: 50, y: 46 },
      { pos: 'MID', x: 72, y: 50 }, { pos: 'MID', x: 90, y: 50 },
      { pos: 'FWD', x: 35, y: 22 }, { pos: 'FWD', x: 65, y: 22 },
    ],
  },
  '4-2-3-1': {
    label: '4–2–3–1',
    slots: [
      { pos: 'GK',  x: 50, y: 88 },
      { pos: 'DEF', x: 17, y: 74 }, { pos: 'DEF', x: 37, y: 74 },
      { pos: 'DEF', x: 63, y: 74 }, { pos: 'DEF', x: 83, y: 74 },
      { pos: 'MID', x: 30, y: 60 }, { pos: 'MID', x: 70, y: 60 },
      { pos: 'MID', x: 18, y: 43 }, { pos: 'MID', x: 50, y: 41 }, { pos: 'MID', x: 82, y: 43 },
      { pos: 'FWD', x: 50, y: 22 },
    ],
  },
  '5-3-2': {
    label: '5–3–2',
    slots: [
      { pos: 'GK',  x: 50, y: 86 },
      { pos: 'DEF', x: 10, y: 72 }, { pos: 'DEF', x: 28, y: 70 },
      { pos: 'DEF', x: 50, y: 70 },
      { pos: 'DEF', x: 72, y: 70 }, { pos: 'DEF', x: 90, y: 72 },
      { pos: 'MID', x: 22, y: 51 }, { pos: 'MID', x: 50, y: 46 }, { pos: 'MID', x: 78, y: 51 },
      { pos: 'FWD', x: 35, y: 22 }, { pos: 'FWD', x: 65, y: 22 },
    ],
  },
}

export const FORMATION_KEYS = Object.keys(FORMATIONS)
