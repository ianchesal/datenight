import { describe, it, expect } from 'vitest'
import { formatRuntime } from '@/lib/utils'

describe('formatRuntime', () => {
  it('formats whole hours with zero minutes', () => {
    expect(formatRuntime(120)).toBe('2h 0m')
  })

  it('formats hours and minutes', () => {
    expect(formatRuntime(207)).toBe('3h 27m')
  })

  it('formats sub-hour runtimes', () => {
    expect(formatRuntime(45)).toBe('0h 45m')
  })

  it('formats a single minute', () => {
    expect(formatRuntime(1)).toBe('0h 1m')
  })
})
