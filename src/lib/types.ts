export type ScanStatus = "ok" | "error";

export type ConsentFinding = {
  id: string;
  title: string;
  severity: "info" | "warn" | "fail";
  detail: string;
  evidence?: {
    kind: "text" | "selector";
    value: string;
  };
};

export type ScanResult = {
  status: ScanStatus;
  url: string;
  scannedAt: string;
  score: {
    overall: number; // 0-100
    choiceSymmetry: number;
    preConsentSignals: number;
    accessibility: number;
    transparency: number;
  };
  banner: {
    detected: boolean;
    confidence: number; // 0-1
    selectors: string[];
    acceptButtons: string[];
    rejectButtons: string[];
  };
  artifacts: {
    screenshotPath?: string;
  };
  findings: ConsentFinding[];
  meta: {
    userAgent: string;
    tookMs: number;
  };
};
