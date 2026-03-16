import { describe, it, expect } from 'vitest'
import { presets } from '../presets'

describe('presets', () => {
  it('should have at least one preset', () => {
    expect(presets.length).toBeGreaterThan(0)
  })

  it('should have unique preset names', () => {
    const names = presets.map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('should have non-empty sites in each preset', () => {
    for (const preset of presets) {
      expect(preset.sites.length).toBeGreaterThan(0)
    }
  })
})
