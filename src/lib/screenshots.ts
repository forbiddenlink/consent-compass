/**
 * Screenshot Storage Module
 *
 * Provides persistent storage for consent banner screenshots including:
 * - Pre-consent screenshots (before any interaction)
 * - Post-consent screenshots (after clicking accept)
 * - Banner-highlighted screenshots (with visual annotation)
 */

import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

export type ScreenshotType = "pre-consent" | "post-consent" | "banner";

export type ScreenshotPaths = {
  preConsent: string; // Before any interaction
  postConsent?: string; // After clicking accept
  bannerHighlight?: string; // With banner highlighted
};

export type BannerBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// Base directory for screenshot storage
const SCREENSHOTS_DIR = path.join(process.cwd(), "public", "screenshots");

/**
 * Sanitize domain for use as directory name
 */
export function sanitizeDomain(domain: string): string {
  return domain.replace(/[^a-zA-Z0-9.-]/g, "_").toLowerCase();
}

/**
 * Generate timestamp string for filenames
 */
export function generateTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/**
 * Get the full path for a screenshot file
 */
export function getScreenshotFilePath(
  domain: string,
  type: ScreenshotType,
  timestamp?: string
): string {
  const safeDomain = sanitizeDomain(domain);
  const ts = timestamp ?? generateTimestamp();
  return path.join(SCREENSHOTS_DIR, safeDomain, `${ts}_${type}.png`);
}

/**
 * Ensure the screenshot directory exists for a domain
 */
async function ensureDirectoryExists(domain: string): Promise<string> {
  const safeDomain = sanitizeDomain(domain);
  const dirPath = path.join(SCREENSHOTS_DIR, safeDomain);

  await fs.mkdir(dirPath, { recursive: true });
  return dirPath;
}

/**
 * Save a screenshot to persistent storage
 *
 * @param buffer - The screenshot image buffer
 * @param domain - The domain being scanned
 * @param type - Type of screenshot (pre-consent, post-consent, banner)
 * @param timestamp - Optional timestamp (defaults to current time)
 * @returns The relative path from public/screenshots/
 */
export async function saveScreenshot(
  buffer: Buffer,
  domain: string,
  type: ScreenshotType,
  timestamp?: string
): Promise<string> {
  await ensureDirectoryExists(domain);

  const filePath = getScreenshotFilePath(domain, type, timestamp);

  await fs.writeFile(filePath, buffer);

  // Return relative path from public/screenshots/
  const safeDomain = sanitizeDomain(domain);
  const ts = timestamp ?? generateTimestamp();
  return `${safeDomain}/${ts}_${type}.png`;
}

/**
 * Create an annotated screenshot with the banner area highlighted
 *
 * @param screenshot - The original screenshot buffer
 * @param bannerBounds - The bounding box of the banner
 * @returns Buffer with the banner area highlighted
 */
export async function annotateBanner(
  screenshot: Buffer,
  bannerBounds: BannerBounds
): Promise<Buffer> {
  const { x, y, width, height } = bannerBounds;

  // Get image dimensions
  const metadata = await sharp(screenshot).metadata();
  const imgWidth = metadata.width ?? 1440;
  const imgHeight = metadata.height ?? 900;

  // Ensure bounds are within image
  const safeX = Math.max(0, Math.round(x));
  const safeY = Math.max(0, Math.round(y));
  const safeWidth = Math.min(Math.round(width), imgWidth - safeX);
  const safeHeight = Math.min(Math.round(height), imgHeight - safeY);

  // Skip annotation if bounds are invalid
  if (safeWidth <= 0 || safeHeight <= 0) {
    return screenshot;
  }

  // Create a semi-transparent overlay rectangle
  const borderWidth = 3;
  const borderColor = { r: 255, g: 69, b: 0 }; // Orange-red

  // Create SVG overlay with border rectangle
  const svgOverlay = Buffer.from(`
    <svg width="${imgWidth}" height="${imgHeight}">
      <rect
        x="${safeX}"
        y="${safeY}"
        width="${safeWidth}"
        height="${safeHeight}"
        fill="rgba(255, 69, 0, 0.1)"
        stroke="rgb(${borderColor.r}, ${borderColor.g}, ${borderColor.b})"
        stroke-width="${borderWidth}"
      />
    </svg>
  `);

  // Composite the overlay onto the original image
  const annotated = await sharp(screenshot)
    .composite([
      {
        input: svgOverlay,
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return annotated;
}

/**
 * List all screenshots for a domain, sorted by date (newest first)
 */
export async function listScreenshots(domain: string): Promise<string[]> {
  const safeDomain = sanitizeDomain(domain);
  const dirPath = path.join(SCREENSHOTS_DIR, safeDomain);

  try {
    const files = await fs.readdir(dirPath);
    return files
      .filter((f) => f.endsWith(".png"))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/**
 * Clean up old screenshots, keeping only the most recent N sets
 *
 * A "set" is defined as screenshots sharing the same timestamp prefix
 *
 * @param domain - The domain to clean up
 * @param keepCount - Number of screenshot sets to keep
 */
export async function cleanupScreenshots(
  domain: string,
  keepCount: number
): Promise<void> {
  const safeDomain = sanitizeDomain(domain);
  const dirPath = path.join(SCREENSHOTS_DIR, safeDomain);

  let files: string[];
  try {
    files = await fs.readdir(dirPath);
  } catch {
    return; // Directory doesn't exist, nothing to clean
  }

  // Group files by timestamp prefix (everything before the underscore + type)
  const timestampSets = new Map<string, string[]>();

  for (const file of files) {
    if (!file.endsWith(".png")) continue;

    // Extract timestamp from filename (format: YYYY-MM-DDTHH-MM-SS-MMMZ_type.png)
    const match = file.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)_/);
    if (match) {
      const timestamp = match[1];
      const existing = timestampSets.get(timestamp) ?? [];
      existing.push(file);
      timestampSets.set(timestamp, existing);
    }
  }

  // Sort timestamps (newest first) and delete older sets
  const sortedTimestamps = [...timestampSets.keys()].sort().reverse();

  for (let i = keepCount; i < sortedTimestamps.length; i++) {
    const timestamp = sortedTimestamps[i];
    const filesToDelete = timestampSets.get(timestamp) ?? [];

    for (const file of filesToDelete) {
      try {
        await fs.unlink(path.join(dirPath, file));
      } catch {
        // Ignore deletion errors
      }
    }
  }
}

/**
 * Get the public URL for serving a screenshot
 *
 * @param relativePath - The relative path from saveScreenshot
 * @returns The URL path for serving the screenshot
 */
export function getScreenshotUrl(relativePath: string): string {
  return `/screenshots/${relativePath}`;
}

/**
 * Delete all screenshots for a domain
 */
export async function deleteAllScreenshots(domain: string): Promise<void> {
  const safeDomain = sanitizeDomain(domain);
  const dirPath = path.join(SCREENSHOTS_DIR, safeDomain);

  try {
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      await fs.unlink(path.join(dirPath, file));
    }
    await fs.rmdir(dirPath);
  } catch {
    // Directory doesn't exist or already empty
  }
}

/**
 * Check if screenshots directory exists for a domain
 */
export async function screenshotsExist(domain: string): Promise<boolean> {
  const safeDomain = sanitizeDomain(domain);
  const dirPath = path.join(SCREENSHOTS_DIR, safeDomain);

  try {
    await fs.access(dirPath);
    return true;
  } catch {
    return false;
  }
}
