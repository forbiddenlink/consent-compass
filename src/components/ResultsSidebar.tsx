import type { ScanResult } from "@/lib/types";
import { SignalSection, EmptyData } from "./ui";

interface ResultsSidebarProps {
  result: ScanResult;
}

export function ResultsSidebar({ result }: ResultsSidebarProps) {
  return (
    <div className="border-2 border-ink bg-panel p-6 text-ink">
      <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-soft">Artifacts</div>
      <div className="mt-3">
        <SignalSection label="Screenshot">
          {result.artifacts.screenshotPath || <EmptyData />}
        </SignalSection>
      </div>

      <hr className="my-6 border-ink" />

      <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-soft">Signal Summary</div>
      <div className="mt-4 flex flex-col divide-y divide-rule-soft [&>*]:py-3">
        <SignalSection label="Accept buttons">
          {result.banner.acceptButtons.length ? result.banner.acceptButtons.join(" · ") : <EmptyData />}
        </SignalSection>

        <SignalSection label="Reject buttons">
          {result.banner.rejectButtons.length ? result.banner.rejectButtons.join(" · ") : <EmptyData />}
        </SignalSection>

        <SignalSection label="Manage preferences">
          {result.banner.managePrefsButtons.length ? result.banner.managePrefsButtons.join(" · ") : <EmptyData />}
        </SignalSection>

        <SignalSection label="Matched selectors">
          {result.banner.selectors.length ? result.banner.selectors.join(" · ") : <EmptyData />}
        </SignalSection>

        </div>
        <div className="py-3">

        {/* Cookie Categories */}
        {result.preConsent.cookiesByCategory && (
          <CookieCategoriesSection categories={result.preConsent.cookiesByCategory} />
        )}

        {/* Google Consent Mode */}
        {result.googleConsentMode?.detected && (
          <div className="py-3">
            <GoogleConsentModeSection gcm={result.googleConsentMode} />
          </div>
        )}
        <div className="py-3">

        <SignalSection label="Pre-consent cookies">
          {result.preConsent.cookies.length
            ? result.preConsent.cookies.slice(0, 10).map((c) => c.name).join(" · ")
            : <EmptyData />}
        </SignalSection>

        <SignalSection label="Pre-consent requests">
          {result.preConsent.requests.length
            ? result.preConsent.requests.slice(0, 6).map((r) => {
                try {
                  return `${r.resourceType}: ${r.domain}`;
                } catch {
                  return r.resourceType;
                }
              }).join(" · ")
            : <EmptyData />}
        </SignalSection>
        </div>
      </div>
    </div>
  );
}

function CookieCategoriesSection({ categories }: { categories: NonNullable<ScanResult["preConsent"]["cookiesByCategory"]> }) {
  return (
    <div className="space-y-2">
      <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-soft">Cookies by Category</div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center justify-between border-2 border-ink bg-cobalt-tint px-2 py-1">
          <span className="text-cobalt-deep font-semibold">Necessary</span>
          <span className="font-mono text-cobalt-deep">{categories.necessary}</span>
        </div>
        <div className="flex items-center justify-between border-2 border-ink bg-canvas px-2 py-1">
          <span className="text-ink font-semibold">Functional</span>
          <span className="font-mono text-ink">{categories.functional}</span>
        </div>
        <div className="flex items-center justify-between border-2 border-ink bg-panel px-2 py-1">
          <span className="text-signal-text font-semibold">Analytics</span>
          <span className="font-mono text-signal-text">{categories.analytics}</span>
        </div>
        <div className="flex items-center justify-between border-2 border-ink bg-signal px-2 py-1">
          <span className="text-ink font-semibold">Marketing</span>
          <span className="font-mono text-ink">{categories.marketing}</span>
        </div>
      </div>
      {categories.unknown > 0 && (
        <div className="text-[11px] text-ink-soft">
          + {categories.unknown} unclassified
        </div>
      )}
    </div>
  );
}

function GoogleConsentModeSection({ gcm }: { gcm: ScanResult["googleConsentMode"] }) {
  if (!gcm) return null;
  return (
    <div className="space-y-2">
      <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-soft">Google Consent Mode</div>
      <div className="flex items-center gap-2">
        <span className={`border-2 px-2 py-0.5 font-mono text-[11px] font-semibold ${
          gcm.version === "v2"
            ? "border-cobalt-deep bg-cobalt-tint text-cobalt-deep"
            : "border-signal-text bg-panel text-signal-text"
        }`}>
          {gcm.version?.toUpperCase() || "Detected"}
        </span>
        {gcm.issues && gcm.issues.length > 0 && (
          <span className="text-[11px] text-ink font-semibold">
            {gcm.issues.length} issue(s)
          </span>
        )}
      </div>
      {gcm.signals && (
        <div className="grid grid-cols-2 gap-1 text-[11px]">
          {Object.entries(gcm.signals).map(([key, value]) => (
            <div key={key} className="flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${
                value === "granted" ? "bg-cobalt" : value === "denied" ? "bg-signal" : "bg-ink-soft"
              }`} />
              <span className="text-ink-soft">{key.replace(/_/g, " ")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
