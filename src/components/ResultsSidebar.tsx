import type { ScanResult } from "@/lib/types";
import { SignalSection, EmptyData } from "./ui";

interface ResultsSidebarProps {
  result: ScanResult;
}

export function ResultsSidebar({ result }: ResultsSidebarProps) {
  return (
    <div className="rounded-lg border border-white/[8%] bg-white/[3%] p-6">
      <div className="text-xs font-medium uppercase tracking-wide text-white/50">Artifacts</div>
      <div className="mt-3">
        <SignalSection label="Screenshot">
          {result.artifacts.screenshotPath || <EmptyData />}
        </SignalSection>
      </div>

      <hr className="my-6 border-white/[6%]" />

      <div className="text-xs font-medium uppercase tracking-wide text-white/50">Signal Summary</div>
      <div className="mt-4 space-y-5">
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

        <hr className="border-white/[6%]" />

        {/* Cookie Categories */}
        {result.preConsent.cookiesByCategory && (
          <CookieCategoriesSection categories={result.preConsent.cookiesByCategory} />
        )}

        {/* Google Consent Mode */}
        {result.googleConsentMode?.detected && (
          <>
            <hr className="border-white/[6%]" />
            <GoogleConsentModeSection gcm={result.googleConsentMode} />
          </>
        )}

        <hr className="border-white/[6%]" />

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
  );
}

function CookieCategoriesSection({ categories }: { categories: NonNullable<ScanResult["preConsent"]["cookiesByCategory"]> }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-white/40">Cookies by Category</div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center justify-between rounded-md bg-emerald-500/10 px-2 py-1">
          <span className="text-emerald-400">Necessary</span>
          <span className="font-mono text-emerald-300">{categories.necessary}</span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-sky-500/10 px-2 py-1">
          <span className="text-sky-400">Functional</span>
          <span className="font-mono text-sky-300">{categories.functional}</span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-amber-500/10 px-2 py-1">
          <span className="text-amber-400">Analytics</span>
          <span className="font-mono text-amber-300">{categories.analytics}</span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-rose-500/10 px-2 py-1">
          <span className="text-rose-400">Marketing</span>
          <span className="font-mono text-rose-300">{categories.marketing}</span>
        </div>
      </div>
      {categories.unknown > 0 && (
        <div className="text-[11px] text-white/40">
          + {categories.unknown} unclassified
        </div>
      )}
    </div>
  );
}

function GoogleConsentModeSection({ gcm }: { gcm: NonNullable<ScanResult["googleConsentMode"]> }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-white/40">Google Consent Mode</div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
          gcm.version === "v2"
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-amber-500/10 text-amber-400"
        }`}>
          {gcm.version?.toUpperCase() || "Detected"}
        </span>
        {gcm.issues && gcm.issues.length > 0 && (
          <span className="text-[11px] text-rose-400">
            {gcm.issues.length} issue(s)
          </span>
        )}
      </div>
      {gcm.signals && (
        <div className="grid grid-cols-2 gap-1 text-[11px]">
          {Object.entries(gcm.signals).map(([key, value]) => (
            <div key={key} className="flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${
                value === "granted" ? "bg-emerald-400" : value === "denied" ? "bg-rose-400" : "bg-white/20"
              }`} />
              <span className="text-white/50">{key.replace(/_/g, " ")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
