import { mock } from "bun:test"

export const mockIntro = mock(() => {})
export const mockOutro = mock(() => {})
export const mockCancel = mock((_msg?: string) => {})
export const mockConfirm = mock(() => Promise.resolve(false))
export const mockIsCancel = mock((value: unknown) => value === Symbol.for("clack:cancel"))
export const mockText = mock(() => Promise.resolve(""))
export const mockSelect = mock(() => Promise.resolve(""))
const mockSpinnerStart = mock(() => {})
const mockSpinnerStop = mock(() => {})
export const mockSpinner = mock(() => ({ start: mockSpinnerStart, stop: mockSpinnerStop }))
export const mockSpinnerInstance = { start: mockSpinnerStart, stop: mockSpinnerStop }
export const mockLog = {
  message: mock((_text?: string) => {}),
  error: mock(() => {}),
  info: mock(() => {}),
  warn: mock(() => {}),
  success: mock(() => {}),
  step: mock(() => {}),
}

mock.module("@clack/prompts", () => ({
  intro: mockIntro,
  outro: mockOutro,
  cancel: mockCancel,
  confirm: mockConfirm,
  isCancel: mockIsCancel,
  log: mockLog,
  spinner: mockSpinner,
  text: mockText,
  select: mockSelect,
  multiselect: mock(() => Promise.resolve([])),
  password: mock(() => Promise.resolve("")),
  group: mock(() => Promise.resolve({})),
  note: mock(() => {}),
  selectKey: mock(() => Promise.resolve("")),
}))
