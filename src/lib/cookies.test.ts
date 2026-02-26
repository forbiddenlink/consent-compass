import { describe, it, expect } from 'vitest'
import {
  categorizeCookie,
  categorizeCookies,
  summarizeCookiesByCategory,
  getHighRiskCookies,
  hasPreConsentTracking,
} from './cookies'
import type { CategorizedCookie } from './types'

describe('categorizeCookie', () => {
  describe('necessary cookies', () => {
    it('categorizes Cloudflare cookies as necessary', () => {
      // __cfduid matches __cf pattern (Cloudflare security)
      expect(categorizeCookie('__cfduid')).toMatchObject({
        category: 'necessary',
        vendor: 'Cloudflare',
      })
      expect(categorizeCookie('__cfwaitingroom')).toMatchObject({
        category: 'necessary',
        vendor: 'Cloudflare',
      })
    })

    it('categorizes session cookies as necessary', () => {
      expect(categorizeCookie('JSESSIONID')).toMatchObject({ category: 'necessary' })
      expect(categorizeCookie('PHPSESSID')).toMatchObject({ category: 'necessary' })
      expect(categorizeCookie('ASP.NET_SessionId')).toMatchObject({ category: 'necessary' })
    })

    it('categorizes CSRF tokens as necessary', () => {
      expect(categorizeCookie('csrf_token')).toMatchObject({ category: 'necessary' })
      expect(categorizeCookie('_csrf')).toMatchObject({ category: 'necessary' })
      expect(categorizeCookie('XSRF-TOKEN')).toMatchObject({ category: 'necessary' })
    })

    it('categorizes AWS load balancer cookies as necessary', () => {
      expect(categorizeCookie('AWSALB')).toMatchObject({
        category: 'necessary',
        vendor: 'AWS',
      })
      expect(categorizeCookie('AWSELB')).toMatchObject({
        category: 'necessary',
        vendor: 'AWS',
      })
    })

    it('categorizes consent management cookies as necessary', () => {
      expect(categorizeCookie('CookieConsent')).toMatchObject({
        category: 'necessary',
        vendor: 'Cookiebot',
      })
      expect(categorizeCookie('OptanonConsent')).toMatchObject({
        category: 'necessary',
        vendor: 'OneTrust',
      })
    })

    it('categorizes auth cookies as necessary', () => {
      expect(categorizeCookie('auth_token')).toMatchObject({ category: 'necessary' })
      expect(categorizeCookie('session_id')).toMatchObject({ category: 'necessary' })
      expect(categorizeCookie('access_token')).toMatchObject({ category: 'necessary' })
    })
  })

  describe('functional cookies', () => {
    it('categorizes language/locale cookies as functional', () => {
      expect(categorizeCookie('lang')).toMatchObject({ category: 'functional' })
      expect(categorizeCookie('locale')).toMatchObject({ category: 'functional' })
      expect(categorizeCookie('language')).toMatchObject({ category: 'functional' })
      expect(categorizeCookie('country')).toMatchObject({ category: 'functional' })
    })

    it('categorizes UI preference cookies as functional', () => {
      expect(categorizeCookie('theme')).toMatchObject({ category: 'functional' })
      expect(categorizeCookie('dark_mode')).toMatchObject({ category: 'functional' })
    })

    it('categorizes A/B test cookies as functional', () => {
      expect(categorizeCookie('ab_test_variant')).toMatchObject({ category: 'functional' })
      expect(categorizeCookie('experiment_id')).toMatchObject({ category: 'functional' })
    })
  })

  describe('analytics cookies', () => {
    it('categorizes Google Analytics cookies as analytics', () => {
      expect(categorizeCookie('_ga')).toMatchObject({
        category: 'analytics',
        vendor: 'Google Analytics',
      })
      expect(categorizeCookie('_ga_ABC123')).toMatchObject({
        category: 'analytics',
        vendor: 'Google Analytics 4',
      })
      expect(categorizeCookie('_gid')).toMatchObject({
        category: 'analytics',
        vendor: 'Google Analytics',
      })
      expect(categorizeCookie('_gat_UA12345')).toMatchObject({
        category: 'analytics',
        vendor: 'Google Analytics',
      })
    })

    it('categorizes Mixpanel cookies as analytics', () => {
      expect(categorizeCookie('mp_abc123_mixpanel')).toMatchObject({
        category: 'analytics',
        vendor: 'Mixpanel',
      })
    })

    it('categorizes Hotjar cookies as analytics', () => {
      expect(categorizeCookie('_hjSessionUser_123')).toMatchObject({
        category: 'analytics',
        vendor: 'Hotjar',
      })
      expect(categorizeCookie('_hjid')).toMatchObject({
        category: 'analytics',
        vendor: 'Hotjar',
      })
    })

    it('categorizes HubSpot cookies as analytics', () => {
      expect(categorizeCookie('hubspotutk')).toMatchObject({
        category: 'analytics',
        vendor: 'HubSpot',
      })
      expect(categorizeCookie('__hstc')).toMatchObject({
        category: 'analytics',
        vendor: 'HubSpot',
      })
    })

    it('categorizes Microsoft Clarity cookies as analytics', () => {
      expect(categorizeCookie('_clck')).toMatchObject({
        category: 'analytics',
        vendor: 'Microsoft Clarity',
      })
      expect(categorizeCookie('_clsk')).toMatchObject({
        category: 'analytics',
        vendor: 'Microsoft Clarity',
      })
    })
  })

  describe('marketing cookies', () => {
    it('categorizes Facebook cookies as marketing', () => {
      expect(categorizeCookie('_fbp')).toMatchObject({
        category: 'marketing',
        vendor: 'Facebook',
      })
      expect(categorizeCookie('_fbc')).toMatchObject({
        category: 'marketing',
        vendor: 'Facebook',
      })
      expect(categorizeCookie('fr')).toMatchObject({
        category: 'marketing',
        vendor: 'Facebook',
      })
    })

    it('categorizes Google Ads cookies as marketing', () => {
      expect(categorizeCookie('_gcl_aw')).toMatchObject({
        category: 'marketing',
        vendor: 'Google Ads',
      })
      expect(categorizeCookie('IDE')).toMatchObject({
        category: 'marketing',
        vendor: 'Google DoubleClick',
      })
      expect(categorizeCookie('__gads')).toMatchObject({
        category: 'marketing',
        vendor: 'Google Ads',
      })
    })

    it('categorizes LinkedIn cookies as marketing', () => {
      expect(categorizeCookie('li_sugr')).toMatchObject({
        category: 'marketing',
        vendor: 'LinkedIn',
      })
      expect(categorizeCookie('bcookie')).toMatchObject({
        category: 'marketing',
        vendor: 'LinkedIn',
      })
      expect(categorizeCookie('UserMatchHistory')).toMatchObject({
        category: 'marketing',
        vendor: 'LinkedIn',
      })
    })

    it('categorizes TikTok cookies as marketing', () => {
      expect(categorizeCookie('_ttp')).toMatchObject({
        category: 'marketing',
        vendor: 'TikTok',
      })
      expect(categorizeCookie('_tt_enable_cookie')).toMatchObject({
        category: 'marketing',
        vendor: 'TikTok',
      })
    })

    it('categorizes Twitter cookies as marketing', () => {
      expect(categorizeCookie('twid')).toMatchObject({
        category: 'marketing',
        vendor: 'Twitter',
      })
      expect(categorizeCookie('personalization_id')).toMatchObject({
        category: 'marketing',
        vendor: 'Twitter',
      })
    })

    it('categorizes ad tech vendor cookies as marketing', () => {
      expect(categorizeCookie('criteo_user_id')).toMatchObject({
        category: 'marketing',
        vendor: 'Criteo',
      })
      expect(categorizeCookie('taboola_session_id')).toMatchObject({
        category: 'marketing',
        vendor: 'Taboola',
      })
    })
  })

  describe('domain-based fallbacks', () => {
    it('categorizes cookies from tracker domains', () => {
      expect(categorizeCookie('unknown_cookie', 'doubleclick.net')).toMatchObject({
        category: 'marketing',
        vendor: 'Google Ads',
      })
      expect(categorizeCookie('xyz', 'facebook.com')).toMatchObject({
        category: 'marketing',
        vendor: 'Facebook',
      })
      expect(categorizeCookie('abc', 'google-analytics.com')).toMatchObject({
        category: 'analytics',
        vendor: 'Google Analytics',
      })
      expect(categorizeCookie('def', 'linkedin.com')).toMatchObject({
        category: 'marketing',
        vendor: 'LinkedIn',
      })
    })
  })

  describe('unknown cookies', () => {
    it('returns unknown for unrecognized cookies', () => {
      expect(categorizeCookie('my_custom_cookie')).toEqual({ category: 'unknown' })
      expect(categorizeCookie('xyz123')).toEqual({ category: 'unknown' })
    })
  })
})

describe('categorizeCookies', () => {
  it('categorizes an array of cookies', () => {
    const cookies = [
      { name: '_ga', domain: '.example.com' },
      { name: '_fbp', domain: '.example.com' },
      { name: 'PHPSESSID' },
    ]

    const result = categorizeCookies(cookies)

    expect(result).toHaveLength(3)
    expect(result[0].category).toBe('analytics')
    expect(result[1].category).toBe('marketing')
    expect(result[2].category).toBe('necessary')
  })

  it('preserves original cookie properties', () => {
    const cookies = [
      { name: '_ga', domain: '.example.com', value: 'GA1.2.123', path: '/' },
    ]

    const result = categorizeCookies(cookies)

    expect(result[0]).toMatchObject({
      name: '_ga',
      domain: '.example.com',
      value: 'GA1.2.123',
      path: '/',
      category: 'analytics',
    })
  })
})

describe('summarizeCookiesByCategory', () => {
  it('counts cookies by category', () => {
    const cookies: CategorizedCookie[] = [
      { name: '_ga', category: 'analytics' },
      { name: '_gid', category: 'analytics' },
      { name: '_fbp', category: 'marketing' },
      { name: 'PHPSESSID', category: 'necessary' },
      { name: 'unknown_cookie', category: 'unknown' },
    ]

    const summary = summarizeCookiesByCategory(cookies)

    expect(summary).toEqual({
      necessary: 1,
      functional: 0,
      analytics: 2,
      marketing: 1,
      unknown: 1,
    })
  })

  it('returns zeros for empty array', () => {
    const summary = summarizeCookiesByCategory([])

    expect(summary).toEqual({
      necessary: 0,
      functional: 0,
      analytics: 0,
      marketing: 0,
      unknown: 0,
    })
  })
})

describe('getHighRiskCookies', () => {
  it('returns only analytics and marketing cookies', () => {
    const cookies: CategorizedCookie[] = [
      { name: '_ga', category: 'analytics' },
      { name: '_fbp', category: 'marketing' },
      { name: 'PHPSESSID', category: 'necessary' },
      { name: 'lang', category: 'functional' },
      { name: 'xyz', category: 'unknown' },
    ]

    const highRisk = getHighRiskCookies(cookies)

    expect(highRisk).toHaveLength(2)
    expect(highRisk.map(c => c.name)).toEqual(['_ga', '_fbp'])
  })

  it('returns empty array when no high-risk cookies', () => {
    const cookies: CategorizedCookie[] = [
      { name: 'PHPSESSID', category: 'necessary' },
      { name: 'lang', category: 'functional' },
    ]

    expect(getHighRiskCookies(cookies)).toHaveLength(0)
  })
})

describe('hasPreConsentTracking', () => {
  it('returns no tracking when no high-risk cookies', () => {
    const cookies: CategorizedCookie[] = [
      { name: 'PHPSESSID', category: 'necessary' },
    ]

    const result = hasPreConsentTracking(cookies)

    expect(result).toEqual({
      hasTracking: false,
      trackingCookies: [],
      severity: 'none',
    })
  })

  it('returns warn severity for analytics-only cookies', () => {
    const cookies: CategorizedCookie[] = [
      { name: '_ga', category: 'analytics' },
      { name: '_gid', category: 'analytics' },
    ]

    const result = hasPreConsentTracking(cookies)

    expect(result.hasTracking).toBe(true)
    expect(result.trackingCookies).toHaveLength(2)
    expect(result.severity).toBe('warn')
  })

  it('returns fail severity when marketing cookies present', () => {
    const cookies: CategorizedCookie[] = [
      { name: '_ga', category: 'analytics' },
      { name: '_fbp', category: 'marketing' },
    ]

    const result = hasPreConsentTracking(cookies)

    expect(result.hasTracking).toBe(true)
    expect(result.severity).toBe('fail')
  })
})
