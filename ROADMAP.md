# Consent Compass Roadmap

## Vision
Build the most accurate, developer-friendly consent compliance scanner — combining automated cookie classification, dark pattern detection, and multi-regulation compliance checking.

---

## Phase 1: Foundation (Current Sprint)

### 1.1 Input Validation & Security
- [ ] URL allowlist/denylist (block localhost, private IPs)
- [ ] URL normalization (always https, strip fragments)
- [ ] Output schema validation with Zod

### 1.2 Rate Limiting
- [ ] Per-IP rate limiting (token bucket)
- [ ] Per-domain concurrency limits
- [ ] 429 responses with Retry-After header

### 1.3 Error Handling
- [ ] Differentiate timeout vs crash vs validation errors
- [ ] Proper HTTP status codes (504 for timeout, 500 for crash)
- [ ] Structured error responses

### 1.4 Testing
- [ ] Unit tests for heuristics (button detection, scoring)
- [ ] Integration tests for API endpoint
- [ ] Fixture-based tests with sample HTML

---

## Phase 2: Scanner Accuracy

### 2.1 Cookie Categorization
- [ ] Integrate Open Cookie Database (10,000+ cookies)
- [ ] Pattern matching fallback (_ga*, _fbp, etc.)
- [ ] Display category in findings (necessary/functional/analytics/marketing)

### 2.2 Post-Consent Comparison
- [ ] Click accept button after initial scan
- [ ] Capture cookies/requests after consent
- [ ] Diff pre vs post consent state
- [ ] Flag violations: cookies that existed before consent

### 2.3 Google Consent Mode v2
- [ ] Detect dataLayer consent signals
- [ ] Verify ad_storage, analytics_storage, ad_user_data, ad_personalization
- [ ] Report missing or misconfigured signals

### 2.4 Tracker Database
- [ ] Integrate WhoTracksMe domain list
- [ ] Flag known trackers in pre-consent requests
- [ ] Classify by type (analytics, advertising, fingerprinting)

---

## Phase 3: Dark Pattern Detection

### 3.1 Visual Button Analysis
- [ ] Capture button bounding boxes
- [ ] Calculate size ratio (accept vs reject)
- [ ] Check color contrast ratios (WCAG 4.5:1)
- [ ] Score visual prominence asymmetry

### 3.2 Multi-Layer CMP Detection
- [ ] Actually click through preference layers
- [ ] Track DOM changes between layers
- [ ] Count real clicks needed to reject
- [ ] Detect shadow DOM consent banners

### 3.3 Friction Scoring
- [ ] Time-based friction (how long to reject)
- [ ] Cognitive friction (confusing language)
- [ ] Overall friction score (0-100)

---

## Phase 4: Production Hardening

### 4.1 Data Persistence
- [ ] SQLite/Postgres for scan history
- [ ] Store full scan results as JSONB
- [ ] Enable trend analysis over time

### 4.2 Export Formats
- [ ] PDF report with annotated screenshots
- [ ] JSON export for integrations
- [ ] CSV cookie inventory

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

- [ ] Extract inline components to src/components/
- [ ] Add TypeScript strict mode
- [ ] Set up CI/CD pipeline
- [ ] Add Playwright test fixtures
- [ ] Document API with OpenAPI spec

---

## Resources

- [Open Cookie Database](https://github.com/jkwakman/Open-Cookie-Database)
- [WhoTracksMe](https://github.com/whotracksme/whotracks.me)
- [ConsentCrawl Reference](https://github.com/dumkydewilde/consentcrawl)
- [CNIL Dark Patterns Guide](https://www.cnil.fr/en/dark-patterns-cookie-banners)
- [Google Consent Mode v2](https://developers.google.com/tag-platform/security/guides/consent)
