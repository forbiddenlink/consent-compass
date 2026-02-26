# Data Persistence & Historical Comparison Design

**Date:** 2026-02-26
**Phase:** 4.1 (Data Persistence) + 4.3 (Historical Comparison)

## Overview

Add scan history storage and comparison capabilities to enable trend analysis and compliance regression detection.

## Database Choice

**SQLite with better-sqlite3** - chosen for:
- Zero configuration
- File-based (easy backup)
- Synchronous API (faster than async for SQLite)
- Perfect for single-instance deployments

## Schema

```sql
CREATE TABLE scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  scanned_at TEXT NOT NULL,
  score INTEGER,
  status TEXT NOT NULL,
  result TEXT NOT NULL  -- Full ScanResult as JSON
);
CREATE INDEX idx_domain_date ON scans(domain, scanned_at DESC);
```

Design decisions:
- **JSONB for result** - Flexibility over normalized tables; scan schema evolves frequently
- **Domain extracted** - Enables grouping scans by site
- **Score denormalized** - Quick queries without JSON parsing

## API Endpoints

### GET /api/history
List all domains with scan counts.

Response:
```json
{
  "domains": [
    { "domain": "example.com", "scanCount": 5, "latestScan": "2026-02-26T12:00:00Z" }
  ]
}
```

### GET /api/history?domain=example.com
List scans for a specific domain.

Response:
```json
{
  "scans": [
    { "id": 1, "url": "https://example.com", "scannedAt": "...", "score": 85, "status": "ok" }
  ]
}
```

### GET /api/history/[id]
Get full scan result by ID.

### GET /api/diff?id1=X&id2=Y
Compare two scans.

Response:
```json
{
  "scan1Id": 1,
  "scan2Id": 2,
  "scoreChange": { "from": 75, "to": 85, "delta": 10, "direction": "improved" },
  "cookiesAdded": [...],
  "cookiesRemoved": [...],
  "findingsAdded": [...],
  "findingsResolved": [...],
  "trackersAdded": [...],
  "trackersRemoved": [...],
  "summary": {
    "improved": true,
    "regressed": false,
    "totalChanges": 5
  }
}
```

## Files

| File | Purpose |
|------|---------|
| `src/lib/db.ts` | Database connection, CRUD operations |
| `src/lib/db.test.ts` | 24 tests |
| `src/lib/diff.ts` | Pure diff logic |
| `src/lib/diff.test.ts` | 19 tests |
| `src/app/api/history/route.ts` | List endpoint |
| `src/app/api/history/[id]/route.ts` | Single scan endpoint |
| `src/app/api/diff/route.ts` | Comparison endpoint |

## Integration

Scan API (`/api/scan`) now:
1. Saves successful scans to database
2. Returns `scanId` in response

## Not Implemented

- **Weekly automated re-scans** - Requires external cron/scheduler infrastructure
