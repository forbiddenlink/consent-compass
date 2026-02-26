#!/usr/bin/env node
/**
 * Generate tracker-database.ts from WhoTracksMe trackerdb.sql
 *
 * Usage: node scripts/generate-tracker-db.mjs
 *
 * Downloads the trackerdb.sql from GitHub and generates a TypeScript module
 * with a Map of domain -> tracker info for O(1) lookups.
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "../src/lib/tracker-database.ts");

const TRACKERDB_URL =
  "https://raw.githubusercontent.com/whotracksme/whotracks.me/master/whotracksme/data/assets/trackerdb.sql";

// Map WhoTracksMe categories to our tracker categories
// 1=advertising, 2=audio_video_player, 3=consent, 4=customer_interaction,
// 5=extensions, 6=hosting, 7=misc, 8=pornvertising, 9=site_analytics,
// 10=social_media, 11=utilities
const CATEGORY_MAP = {
  1: "advertising",      // advertising
  8: "advertising",      // pornvertising
  9: "analytics",        // site_analytics
  10: "social",          // social_media
  5: "fingerprinting",   // extensions (often fingerprinting scripts)
  // Others (2,3,4,6,7,11) are not classified as trackers
};

async function main() {
  console.log("Downloading trackerdb.sql...");
  const response = await fetch(TRACKERDB_URL);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }
  const sql = await response.text();
  console.log(`Downloaded ${(sql.length / 1024).toFixed(1)} KB`);

  // Parse categories
  const categories = new Map();
  const categoryRegex = /INSERT INTO categories VALUES\((\d+),'([^']+)'\);/g;
  let match;
  while ((match = categoryRegex.exec(sql)) !== null) {
    categories.set(parseInt(match[1]), match[2]);
  }
  console.log(`Parsed ${categories.size} categories`);

  // Parse companies
  const companies = new Map();
  const companyRegex = /INSERT INTO companies VALUES\('([^']+)','([^']+)',/g;
  while ((match = companyRegex.exec(sql)) !== null) {
    companies.set(match[1], match[2]);
  }
  console.log(`Parsed ${companies.size} companies`);

  // Parse trackers (id, name, category_id, website, company_id, ...)
  const trackers = new Map();
  const trackerRegex = /INSERT INTO trackers VALUES\('([^']+)','([^']*)',(\d+),/g;
  while ((match = trackerRegex.exec(sql)) !== null) {
    const [, id, name, categoryId] = match;
    trackers.set(id, {
      name: name || id,
      categoryId: parseInt(categoryId),
    });
  }
  console.log(`Parsed ${trackers.size} trackers`);

  // Parse tracker_domains (tracker_id, domain, ...)
  const domains = [];
  const domainRegex = /INSERT INTO tracker_domains VALUES\('([^']+)','([^']+)',/g;
  while ((match = domainRegex.exec(sql)) !== null) {
    const [, trackerId, domain] = match;
    const tracker = trackers.get(trackerId);
    if (!tracker) continue;

    const ourCategory = CATEGORY_MAP[tracker.categoryId];
    if (!ourCategory) continue; // Skip non-tracker categories

    domains.push({
      domain,
      category: ourCategory,
      tracker: tracker.name,
    });
  }
  console.log(`Parsed ${domains.length} tracker domains`);

  // Sort by domain for consistent output
  domains.sort((a, b) => a.domain.localeCompare(b.domain));

  // Generate TypeScript
  const lines = [
    "// Auto-generated from WhoTracksMe trackerdb.sql",
    "// Source: https://github.com/whotracksme/whotracks.me",
    `// Generated: ${new Date().toISOString().split("T")[0]}`,
    `// Total domains: ${domains.length}`,
    "",
    'export type TrackerCategory = "advertising" | "analytics" | "social" | "fingerprinting";',
    "",
    "export interface TrackerInfo {",
    "  category: TrackerCategory;",
    "  tracker: string;",
    "}",
    "",
    "export const TRACKER_DOMAINS: Map<string, TrackerInfo> = new Map([",
  ];

  for (const { domain, category, tracker } of domains) {
    // Escape quotes in tracker name
    const safeTracker = tracker.replace(/'/g, "\\'").replace(/"/g, '\\"');
    lines.push(`  ["${domain}", { category: "${category}", tracker: "${safeTracker}" }],`);
  }

  lines.push("]);");
  lines.push("");

  const output = lines.join("\n");
  writeFileSync(OUTPUT_PATH, output);
  console.log(`\nGenerated ${OUTPUT_PATH}`);
  console.log(`  - ${domains.length} tracker domains`);

  // Count by category
  const byCat = {};
  for (const d of domains) {
    byCat[d.category] = (byCat[d.category] || 0) + 1;
  }
  for (const [cat, count] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${cat}: ${count}`);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
