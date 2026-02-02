import type { Mock } from "bun:test"

type LooseMock = Mock<(...args: never[]) => unknown> & {
  mockClear(): void
  mockResolvedValue(val: unknown): void
  mockRejectedValue(val: unknown): void
  mockReturnValue(val: unknown): void
  mockImplementation(fn: (...args: never[]) => unknown): void
}

export function asMock(_fn: unknown): LooseMock {
  return _fn as LooseMock
}
