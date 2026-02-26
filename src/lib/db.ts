import Database from "better-sqlite3";
import { join } from "path";
import type { ScanResult, ScanStatus } from "./types";

// Database singleton
let db: Database.Database | null = null;

/**
 * Get the database path based on environment.
 * Uses data/scans.db for production, :memory: for testing.
 */
function getDbPath(): string {
  if (process.env.NODE_ENV === "test" || process.env.USE_MEMORY_DB === "true") {
    return ":memory:";
  }
  return join(process.cwd(), "data", "scans.db");
}

/**
 * Initialize the database with schema.
 * Creates the scans table if it doesn't exist.
 * Returns the database instance.
 */
export function initDb(dbPath?: string): Database.Database {
  const path = dbPath ?? getDbPath();

  // If we already have a connection to the same path, return it
  if (db && !dbPath) {
    return db;
  }

  const database = new Database(path);

  // Enable WAL mode for better concurrent read performance
  database.pragma("journal_mode = WAL");

  // Create schema
  database.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      domain TEXT NOT NULL,
      scanned_at TEXT NOT NULL,
      score INTEGER,
      status TEXT NOT NULL,
      result TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_domain_date ON scans(domain, scanned_at DESC);
  `);

  // Store as singleton if not using custom path
  if (!dbPath) {
    db = database;
  }

  return database;
}

/**
 * Get the database instance, initializing if needed.
 */
export function getDb(): Database.Database {
  if (!db) {
    return initDb();
  }
  return db;
}

/**
 * Close the database connection.
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Extract domain from URL for grouping.
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    // Fallback for invalid URLs - extract what looks like a domain
    const match = url.match(/(?:https?:\/\/)?([^/]+)/);
    return match?.[1] ?? url;
  }
}

/**
 * Stored scan record from database.
 */
export type StoredScan = {
  id: number;
  url: string;
  domain: string;
  scannedAt: string;
  score: number | null;
  status: ScanStatus;
};

/**
 * Save a scan result to the database.
 * Returns the inserted row ID.
 */
export function saveScan(result: ScanResult, database?: Database.Database): number {
  const dbInstance = database ?? getDb();

  const domain = extractDomain(result.url);
  const score = result.status === "ok" ? result.score.overall : null;
  const resultJson = JSON.stringify(result);

  const stmt = dbInstance.prepare(`
    INSERT INTO scans (url, domain, scanned_at, score, status, result)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    result.url,
    domain,
    result.scannedAt,
    score,
    result.status,
    resultJson
  );

  return info.lastInsertRowid as number;
}

/**
 * Get scans for a domain, ordered by date descending.
 */
export function getScansByDomain(
  domain: string,
  limit?: number,
  database?: Database.Database
): StoredScan[] {
  const dbInstance = database ?? getDb();

  let sql = `
    SELECT id, url, domain, scanned_at as scannedAt, score, status
    FROM scans
    WHERE domain = ?
    ORDER BY scanned_at DESC
  `;

  if (limit !== undefined && limit > 0) {
    sql += ` LIMIT ?`;
    const stmt = dbInstance.prepare(sql);
    return stmt.all(domain, limit) as StoredScan[];
  }

  const stmt = dbInstance.prepare(sql);
  return stmt.all(domain) as StoredScan[];
}

/**
 * Get a single scan by ID.
 * Returns the full ScanResult or null if not found.
 */
export function getScanById(
  id: number,
  database?: Database.Database
): ScanResult | null {
  const dbInstance = database ?? getDb();

  const stmt = dbInstance.prepare(`
    SELECT result FROM scans WHERE id = ?
  `);

  const row = stmt.get(id) as { result: string } | undefined;

  if (!row) {
    return null;
  }

  return JSON.parse(row.result) as ScanResult;
}

/**
 * Get all unique domains with their scan counts.
 */
export function getAllDomains(
  database?: Database.Database
): { domain: string; scanCount: number; latestScan: string }[] {
  const dbInstance = database ?? getDb();

  const stmt = dbInstance.prepare(`
    SELECT
      domain,
      COUNT(*) as scanCount,
      MAX(scanned_at) as latestScan
    FROM scans
    GROUP BY domain
    ORDER BY latestScan DESC
  `);

  return stmt.all() as { domain: string; scanCount: number; latestScan: string }[];
}

/**
 * Delete a scan by ID (for testing).
 */
export function deleteScan(id: number, database?: Database.Database): boolean {
  const dbInstance = database ?? getDb();

  const stmt = dbInstance.prepare(`DELETE FROM scans WHERE id = ?`);
  const info = stmt.run(id);

  return info.changes > 0;
}
