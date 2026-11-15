import { describe, expect, it, vi } from 'vitest'

vi.mock('next/font/google', () => ({
  Archivo: () => ({ variable: 'v' }),
  IBM_Plex_Mono: () => ({ variable: 'v' }),
}))
vi.mock('nuqs/adapters/next/app', () => ({ NuqsAdapter: () => null }))
vi.mock('@/components/PostHogProvider', () => ({ PostHogProvider: () => null }))
vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null }))
vi.mock('@vercel/speed-insights/next', () => ({ SpeedInsights: () => null }))
vi.mock('./globals.css', () => ({}))

import { metadata } from './layout'

describe('root metadata', () => {
  it('declares a canonical URL on the production origin', () => {
    expect(metadata.alternates?.canonical).toBe('/')
    expect(String(metadata.metadataBase)).toBe('https://consent-compass.vercel.app/')
  })
})
