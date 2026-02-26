# Research Report: Building a Best-in-Class Consent Banner/Cookie Compliance Scanner

Generated: 2026-02-26

## Executive Summary

Leading consent scanners like Cookiebot, OneTrust, and CookieYes differentiate through automated cookie categorization (using databases of 100,000+ pre-classified cookies), real-time pre-consent violation detection, friction asymmetry measurement, and Google Consent Mode v2 verification. The highest-impact features for Consent Compass are: (1) integrating open-source cookie databases for automatic categorization, (2) implementing before/after consent comparison for violation detection, (3) adding click-path friction metrics, and (4) dark pattern detection through visual analysis of button prominence.

## Research Question

How to build a best-in-class consent banner/cookie compliance scanner - analyzing leading tools, technical detection capabilities, compliance standards, UX/reporting best practices, and technical architecture.

---

## Key Findings

### Finding 1: Leading Tools Feature Analysis

**Cookiebot** (by Usercentrics)
- Patented scanning technology detecting all cookies and trackers automatically
- Instant scan with comprehensive report in under 2 minutes
- Automatic categorization into: necessary, functional, analytics, performance, advertisement
- Monthly regular scans capturing cookies from third-party scripts
- Deep Google Consent Mode v2 integration
- Presets for GDPR, CCPA, LGPD, POPIA, VCDPA
- Source: [Cookiebot Review](https://cybernews.com/privacy-compliance-tools/cookiebot-review/)

**OneTrust**
- Compliance Assistant (2026): flags unauthorized tracking, dark patterns, broken consent signals
- Daily scans with 12 months retained for audit readiness
- Advanced checks for GCM, GPC, IAB TCF & GPP standards
- Validates signal passing and vendor compliance
- Detailed user consent transaction database
- Source: [OneTrust Compliance Assistant](https://www.onetrust.com/blog/introducing-compliance-assistant-continuous-website-risk-monitoring-within-your-cmp/)

**CookieYes**
- Database of 100,000+ pre-categorized cookies
- Crawls and detects HTTP/JavaScript and HTML5 Local Storage cookies
- Detects cookies set during user interaction with banner
- Real-time classification and geo-targeting
- Google Consent Mode scanner integration
- Source: [CookieYes Scanner](https://www.cookieyes.com/cookie-scanner/)

**Complianz** (WordPress)
- Hybrid cookie scanner: WordPress-integrated + simulated website visits
- Periodical scans for changes in cookies, plugins, 3rd party services
- Automatic detection and blocking without user action
- Script Center for organizing iFrames, scripts, plugins by category
- IP-based geolocation for region-specific banners
- Source: [Complianz Features](https://complianz.io/features/)

### Finding 2: Technical Detection Capabilities

**Banner Detection Methods**

| Method | Approach | Tools Using It |
|--------|----------|----------------|
| CSS Selector Matching | `[class*="cookie"]`, `[id*="consent"]`, `#onetrust-banner-sdk` | ConsentCrawl, CookieYes |
| Platform-specific Recognition | YAML config of known CMP signatures | ConsentCrawl |
| Text Pattern Matching | Keywords: "cookie", "consent", "gdpr", "privacy" | Most scanners |
| Machine Learning | Q-Learning, text classification for button recognition | CookieBlock, CookieEnforcer |
| Computer Vision | LLMs "seeing" screen to reason about elements | Emerging tools |

**Button Detection Patterns**
```javascript
// Common accept selectors
'button:has-text("Accept")'
'#onetrust-accept-btn-handler'
'.css-bg-accept'
'[class*="accept"]'

// Common reject selectors
'button:has-text("Reject")'
'button:has-text("Decline")'
'button:has-text("Only necessary")'
'.cookie-reject'
```

Source: [ConsentCrawl GitHub](https://github.com/dumkydewilde/consentcrawl)

**Pre-Consent Violation Detection**

The gold standard approach (used by ConsentCrawl, CookieInspector):
1. Load page with network interception enabled via `page.route()`
2. Capture all cookies and network requests BEFORE any consent interaction
3. Click accept/reject buttons
4. Capture cookies and requests AFTER consent
5. Compare to identify violations

Research finding: 69.7% of sites assumed positive consent before it's given, 21.3% created cookies despite negative consent.
Source: [USENIX CookieBlock Paper](https://www.usenix.org/conference/usenixsecurity22/presentation/bollinger)

**Cookie Categorization**

Automatic categorization uses:
1. **Database lookup** - Match against known cookies (Open Cookie Database: 5 categories)
2. **Pattern matching** - `_ga*` = Google Analytics, `_fbp` = Facebook Pixel
3. **Machine Learning** - CookieMonster achieves 94% F1 score with <1.5ms latency
4. **Domain analysis** - Known tracker domains from WhoTracksMe, Disconnect lists

### Finding 3: Dark Pattern Detection Metrics

**Friction Asymmetry Measurement**

| Metric | How to Measure | Red Flag |
|--------|---------------|----------|
| Click count asymmetry | Count clicks to accept vs reject | Reject > Accept |
| Layer depth | Is reject button on layer 1 or 2+? | 74.3% of sites hide reject in layer 2 |
| Visual prominence | Button size ratio, color contrast | Green accept / gray reject |
| Language neutrality | "Accept All" vs "Manage" (not "Reject") | Asymmetric language |

**Specific Dark Patterns to Detect**

1. **Missing Reject Button** - Accept present, no obvious reject
2. **Hidden Reject** - Reject buried in preferences/settings layer
3. **Color Asymmetry** - High-contrast accept, low-contrast reject
4. **Size Asymmetry** - Large accept, small reject
5. **Language Manipulation** - "Yes, I accept!" vs "No" (loaded language)
6. **Pre-checked Categories** - Non-essential cookies pre-selected
7. **Confirm-shaming** - "No, I don't care about privacy"

Source: [CNIL Dark Patterns Notice](https://www.cnil.fr/en/dark-patterns-cookie-banners-cnil-issues-formal-notice-website-publishers)

**Color Contrast Standards**
- WCAG minimum: 4.5:1 contrast ratio
- Detect if accept button meets this and reject doesn't

### Finding 4: Compliance Standards Checklist

**GDPR Requirements**
- [ ] Consent obtained before setting non-essential cookies
- [ ] Consent is freely given (no pre-checked boxes)
- [ ] Consent is specific (granular by category)
- [ ] Consent is informed (clear explanation of purposes)
- [ ] Consent is unambiguous (affirmative action required)
- [ ] Equal prominence for accept/reject options
- [ ] Easy withdrawal (one click to revoke)
- [ ] Record of consent for audit

**ePrivacy Directive (Article 5(3))**
- Prior opt-in consent required for storing/accessing device data
- Exception only for "strictly necessary" cookies
- Specific, unbundled consent per purpose

**CCPA/CPRA Requirements**
- [ ] Opt-out approach (vs opt-in)
- [ ] "Do Not Sell or Share My Personal Information" link
- [ ] Honor Global Privacy Control (GPC) signal
- [ ] Opt-in consent for minors

**LGPD (Brazil)**
- [ ] Opt-in consent
- [ ] Portuguese language mandatory

**Technical Signals to Verify**

| Signal | How to Check |
|--------|-------------|
| Google Consent Mode v2 | Verify `ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization` parameters |
| Global Privacy Control | Check `navigator.globalPrivacyControl` and `Sec-GPC: 1` header |
| IAB TCF | Validate via IAB CMP Validator (Chrome extension) |

Source: [Cookie Consent Implementation Guide](https://secureprivacy.ai/blog/cookie-consent-implementation)

### Finding 5: UX/Reporting Best Practices

**Report Structure**
1. **Executive Summary** - Overall score, critical issues, compliance status
2. **Scorecard** - Visual breakdown by category (symmetry, pre-consent, accessibility, transparency)
3. **Findings List** - Severity-sorted issues with evidence
4. **Evidence Gallery** - Screenshots with annotations
5. **Cookie Inventory** - Categorized list with purposes
6. **Network Activity** - Pre-consent third-party requests
7. **Recommendations** - Prioritized action items
8. **Compliance Matrix** - Check against GDPR, CCPA, ePrivacy requirements

**Export Formats**
- **PDF** - Primary for sharing with stakeholders, ISO PDF/A for archiving
- **JSON** - Machine-readable for integrations
- **CSV** - Cookie inventory for spreadsheet analysis
- **Markdown** - Developer-friendly reports

**Historical Comparison**
- Store scan results for diff analysis
- Weekly automated scans with change detection
- Alert on: verdict change (PASS/PARTIAL/FAIL), new critical issues
- 12-month retention for audit trails

Source: [ConsentCheck Monitoring](https://consentcheck.online/monitoring)

### Finding 6: Technical Architecture Best Practices

**Browser Automation**
- **Playwright preferred** over Puppeteer for cross-browser support
- Use CDP sessions for efficient resource blocking
- Set up network interception before navigation:

```typescript
// Capture requests before consent
const preConsentRequests: Request[] = [];
page.on('request', req => preConsentRequests.push(req));

// CDP for performance
const client = await page.context().newCDPSession(page);
await client.send('Network.enable');
```

**Cookie Classification Databases**

| Database | Size | Format | License |
|----------|------|--------|---------|
| Open Cookie Database | 10,000+ | CSV, JSON | Open |
| CookieSearch | 100,000+ | Searchable | Open Source |
| WhoTracksMe | Largest tracker DB | JSON | CC BY 4.0 |
| Disconnect Lists | Trackers + fingerprinters | JSON | Open |
| EasyPrivacy | Filter list format | Adblock syntax | Open |

Source: [Open Cookie Database](https://github.com/jkwakman/Open-Cookie-Database)

**Tracker Database Integration**

```typescript
// Example: classify cookie using database
function classifyCookie(name: string, domain: string): CookieCategory {
  // 1. Check Open Cookie Database
  const dbMatch = cookieDb.find(c =>
    c.name === name || (c.wildcard && matchWildcard(c.name, name))
  );
  if (dbMatch) return dbMatch.category;

  // 2. Check known tracker domains
  if (isTrackerDomain(domain, whoTracksMe)) return 'marketing';

  // 3. Pattern matching fallback
  if (name.startsWith('_ga')) return 'analytics';
  if (name.startsWith('_fbp')) return 'marketing';

  return 'unknown';
}
```

**Consent Mode Verification**

```typescript
// Check Google Consent Mode v2 implementation
const gcmState = await page.evaluate(() => {
  return {
    ad_storage: window.dataLayer?.find(d => d['gtm.consent'])?.ad_storage,
    analytics_storage: window.dataLayer?.find(d => d['gtm.consent'])?.analytics_storage,
    ad_user_data: window.dataLayer?.find(d => d['gtm.consent'])?.ad_user_data,
    ad_personalization: window.dataLayer?.find(d => d['gtm.consent'])?.ad_personalization,
  };
});
```

Source: [Google Consent Mode Checker](https://www.cookieyes.com/google-consent-mode-checker/)

---

## Codebase Analysis

The current Consent Compass v0 (`/Volumes/LizsDisk/consent-compass/src/lib/scan.ts`) already implements:

**Current Capabilities**
- Playwright-based scanning with headless Chromium
- Pre-consent cookie and request capture
- Text-based banner detection using keyword hints
- CSS selector matching for common CMP patterns
- Button detection for accept/reject/manage actions
- Basic friction estimation (1 vs 2 clicks)
- Screenshot capture
- Scoring system across 4 categories

**Gaps vs Best-in-Class**

| Capability | Current | Best Practice |
|------------|---------|---------------|
| Cookie categorization | None | Database lookup + ML |
| Cookie database | None | Open Cookie Database integration |
| Post-consent comparison | None | Before/after diff |
| Dark pattern scoring | Basic | Visual prominence analysis |
| Consent Mode verification | None | GCM v2, GPC, TCF checking |
| Historical tracking | None | Scan history + diff |
| Export formats | Screenshot only | PDF, JSON, CSV |
| Tracker identification | None | WhoTracksMe/Disconnect integration |
| Button visual analysis | Text only | Color contrast, size ratio |
| Multi-region compliance | None | Geo-specific rules |

---

## Sources

- [Cookiebot CMP](https://www.cookiebot.com/)
- [Cookiebot Review 2026](https://cybernews.com/privacy-compliance-tools/cookiebot-review/)
- [OneTrust Compliance Assistant](https://www.onetrust.com/blog/introducing-compliance-assistant-continuous-website-risk-monitoring-within-your-cmp/)
- [CookieYes Scanner](https://www.cookieyes.com/cookie-scanner/)
- [Complianz Features](https://complianz.io/features/)
- [ConsentCrawl GitHub](https://github.com/dumkydewilde/consentcrawl)
- [CookieBlock USENIX Paper](https://www.usenix.org/conference/usenixsecurity22/presentation/bollinger)
- [Open Cookie Database](https://github.com/jkwakman/Open-Cookie-Database)
- [WhoTracksMe GitHub](https://github.com/whotracksme/whotracks.me)
- [Disconnect Tracker Protection](https://disconnect.me/trackerprotection)
- [CNIL Dark Patterns Notice](https://www.cnil.fr/en/dark-patterns-cookie-banners-cnil-issues-formal-notice-website-publishers)
- [Cookie Consent Studies (26 Studies)](https://ignite.video/en/articles/basics/cookie-consent-studies)
- [Google Consent Mode Checker](https://www.cookieyes.com/google-consent-mode-checker/)
- [ConsentCheck Monitoring](https://consentcheck.online/monitoring)
- [ePrivacy Directive Guide](https://www.cookiehub.com/eprivacy-directive)
- [Global Privacy Control](https://globalprivacycontrol.org/)
- [IAB TCF Compliance](https://iabeurope.eu/transparency-consent-framework/)
- [Cookiescanner Research Paper](https://dl.acm.org/doi/10.1145/3600160.3605000)
- [Dark Pattern Compliance Guide](https://secureprivacy.ai/blog/dark-pattern-compliance-how-to-stop-manipulative-cookie-banners)

---

## Recommendations

### Priority 1: High Impact, Moderate Effort

1. **Integrate Open Cookie Database**
   - Download CSV/JSON from GitHub
   - Implement lookup function with wildcard matching
   - Auto-categorize detected cookies in findings

2. **Add Post-Consent Comparison**
   - Click accept button after initial scan
   - Capture cookies/requests again
   - Report cookies that existed pre-consent vs new ones

3. **Implement Friction Score**
   - Count actual clicks needed (simulate user flow)
   - Score: Accept clicks vs Reject clicks
   - Detect multi-layer reject patterns

4. **Add Google Consent Mode v2 Check**
   - Verify `ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization`
   - Report if signals are missing or misconfigured

### Priority 2: High Impact, Higher Effort

5. **Dark Pattern Visual Analysis**
   - Capture button bounding boxes and computed styles
   - Calculate size ratio (accept vs reject)
   - Check color contrast ratios
   - Score visual prominence asymmetry

6. **Tracker Database Integration**
   - Integrate WhoTracksMe database
   - Flag known trackers in pre-consent requests
   - Classify by category (analytics, marketing, fingerprinting)

7. **PDF Report Generation**
   - Use puppeteer-pdf or similar
   - Include annotated screenshots
   - Compliance checklist format

### Priority 3: Differentiation Features

8. **Global Privacy Control Detection**
   - Check if site honors `Sec-GPC: 1` header
   - Report compliance with GPC specification

9. **Historical Scan Comparison**
   - Store scan results in SQLite/JSON
   - Show diff between scans
   - Alert on compliance regression

10. **Multi-Region Compliance Matrix**
    - Check against GDPR, CCPA, LGPD requirements
    - Generate region-specific compliance scores

---

## Open Questions

1. **Machine Learning for Button Detection**: Should we implement ML-based button classification (like CookieEnforcer) for better cross-language support, or is text pattern matching sufficient for v1?

2. **CMP-Specific Handlers**: Do we need dedicated detection logic for major CMPs (OneTrust, Cookiebot, Quantcast) or rely on generic heuristics?

3. **Click Simulation Safety**: How far should we go in clicking buttons during scans? Risk of unintended side effects on the target site.

4. **Rate Limiting**: What scan frequency limits should we implement to be good citizens when scanning third-party sites?

5. **Cookie Classification Accuracy**: What's the acceptable false-positive rate for marking cookies as "marketing" vs "functional"?
