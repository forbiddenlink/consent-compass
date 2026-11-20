/**
 * PDF generation using Playwright.
 */

import { chromium } from "playwright";

/**
 * Generate a PDF from HTML content.
 */
export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: "networkidle" });

    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" },
      printBackground: true,
    });

    return Buffer.from(pdf);
  } finally {
    await page.close();
    await browser.close();
  }
}
