/**
 * Shared headless Chromium launcher.
 *
 * On Vercel the function image has no Playwright-managed browser, so we use the
 * Chromium build shipped by @sparticuz/chromium. Everywhere else (local dev, CI,
 * Trigger.dev) we use the browser installed by `playwright install`.
 */

import { chromium, type Browser, type LaunchOptions } from "playwright-core";

export function isServerlessRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.VERCEL) || Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
}

export async function getLaunchOptions(
  env: NodeJS.ProcessEnv = process.env,
): Promise<LaunchOptions> {
  if (!isServerlessRuntime(env)) {
    return { headless: true };
  }
  const { default: sparticuz } = await import("@sparticuz/chromium");
  return {
    headless: true,
    args: sparticuz.args,
    executablePath: await sparticuz.executablePath(),
  };
}

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch(await getLaunchOptions());
}
