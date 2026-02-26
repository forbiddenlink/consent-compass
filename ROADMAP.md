# Consent Compass Roadmap

## Vision
Build the most accurate, developer-friendly consent compliance scanner — combining automated cookie classification, dark pattern detection, and multi-regulation compliance checking.

---

## Phase 1: Foundation (Current Sprint)

### 1.1 Input Validation & Security
- [x] URL allowlist/denylist (block localhost, private IPs)
- [x] URL normalization (always https, strip fragments)
- [x] Output schema validation with Zod

### 1.2 Rate Limiting
- [x] Per-IP rate limiting (token bucket)
- [x] Per-domain concurrency limits
- [x] 429 responses with Retry-After header

### 1.3 Error Handling
- [x] Differentiate timeout vs crash vs validation errors
- [x] Proper HTTP status codes (504 for timeout, 500 for crash)
- [x] Structured error responses

### 1.4 Testing
- [x] Unit tests for cookie categorization (31 tests)
- [x] Unit tests for URL validation (37 tests)
- [x] Unit tests for rate limiting (17 tests)
- [x] Unit tests for heuristics (101 tests - button detection, scoring, findings)
- [x] Integration tests for API endpoint (18 tests)
- [x] Fixture-based tests with sample HTML (inline fixtures in heuristics.test.ts)

---

## Phase 2: Scanner Accuracy

### 2.1 Cookie Categorization
- [x] Pattern matching database (189 patterns covering major vendors)
- [x] Display category in findings (necessary/functional/analytics/marketing)
- [x] Integrate Open Cookie Database (2,249 cookies: 1,989 exact + 260 prefixes)

### 2.2 Post-Consent Comparison
- [x] Click accept button after initial scan
- [x] Capture cookies/requests after consent
- [x] Diff pre vs post consent state
- [x] Flag violations: cookies that existed before consent

### 2.3 Google Consent Mode v2
- [x] Detect dataLayer consent signals
- [x] Verify ad_storage, analytics_storage, ad_user_data, ad_personalization
- [x] Report missing or misconfigured signals

### 2.4 Tracker Database
- [x] Integrate WhoTracksMe domain list (3,581 domains)
- [x] Flag known trackers in pre-consent requests
- [x] Classify by type (analytics, advertising, fingerprinting, social)

---

## Phase 3: Dark Pattern Detection

### 3.1 Visual Button Analysis
- [x] Capture button bounding boxes
- [x] Calculate size ratio (accept vs reject)
- [x] Check color contrast ratios (WCAG 4.5:1)
- [x] Score visual prominence asymmetry

### 3.2 Multi-Layer CMP Detection
- [x] Actually click through preference layers
- [x] Track DOM changes between layers
- [x] Count real clicks needed to reject
- [x] Detect shadow DOM consent banners

### 3.3 Friction Scoring
- [x] Click asymmetry scoring (extra clicks to reject)
- [x] Cognitive friction (dark pattern language detection)
- [x] Overall friction score (0-100, weighted combination)

---

## Phase 4: Production Hardening

### 4.1 Data Persistence
- [ ] SQLite/Postgres for scan history
- [ ] Store full scan results as JSONB
- [ ] Enable trend analysis over time

### 4.2 Export Formats
- [x] PDF report with annotated screenshots
- [x] JSON export for integrations
- [x] CSV cookie inventory

### 4.3 Historical Comparison
- [ ] Diff view between scans
- [ ] Compliance regression alerts
- [ ] Weekly automated re-scans

### 4.4 Screenshot Storage
- [ ] Move from /tmp to persistent storage
- [ ] Generate annotated screenshots (highlight banner)
- [ ] Store before/after consent screenshots

---

## Phase 5: Differentiation

### 5.1 Multi-Regulation Compliance
- [ ] GDPR checklist scoring
- [ ] CCPA/CPRA requirements check
- [ ] ePrivacy Directive compliance
- [ ] Region-specific scoring

### 5.2 Global Privacy Control
- [ ] Detect GPC signal support
- [ ] Verify site honors Sec-GPC: 1 header
- [ ] Report GPC compliance status

### 5.3 Accessibility Audit
- [ ] Banner ARIA labels check
- [ ] Keyboard navigation test
- [ ] Screen reader compatibility
- [ ] Focus trap detection

---

## Technical Debt

- [x] Extract inline components to src/components/
- [x] Add TypeScript strict mode
- [x] Set up Vitest test framework (304 tests)
- [x] Set up CI/CD pipeline (GitHub Actions)
- [x] Extract heuristics to testable module (heuristics.ts with 97.87% coverage)
- [x] Document API with OpenAPI spec

---

## Resources

- [Open Cookie Database](https://github.com/jkwakman/Open-Cookie-Database)
- [WhoTracksMe](https://github.com/whotracksme/whotracks.me)
- [ConsentCrawl Reference](https://github.com/dumkydewilde/consentcrawl)
- [CNIL Dark Patterns Guide](https://www.cnil.fr/en/dark-patterns-cookie-banners)
- [Google Consent Mode v2](https://developers.google.com/tag-platform/security/guides/consent)
