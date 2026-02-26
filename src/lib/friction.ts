/**
 * Friction scoring for consent banners
 *
 * Measures three types of friction:
 * 1. Click asymmetry - more clicks to reject than accept
 * 2. Visual asymmetry - accept button more prominent (from heuristics.ts)
 * 3. Cognitive friction - dark pattern language detection
 */

export interface CognitiveFrictionResult {
  score: number; // 0-100
  patterns: DetectedPattern[];
}

export interface DetectedPattern {
  type: "guilt_trip" | "confusing_terms" | "double_negative" | "false_urgency" | "hidden_reject";
  match: string;
  points: number;
}

export interface FrictionScore {
  overall: number; // 0-100, weighted combination
  clickAsymmetry: number; // 0-100
  visualAsymmetry: number; // 0-100
  cognitive: number; // 0-100
}

// Pattern definitions with point values
// Based on CNIL and EDPB dark pattern guidance
const GUILT_TRIP_PATTERNS = [
  /you'?ll miss (out|personalized|relevant)/i,
  /limited experience/i,
  /are you sure/i,
  /you'?re missing/i,
  /don'?t miss/i,
  /we'?d hate to see you go/i,
  /you might regret/i,
  /without (your )?consent.*(won'?t work|limited)/i,
];

const CONFUSING_TERMS_PATTERNS = [
  /legitimate interest/i,
  /\bpartners?\b.*\b(share|access|use)\b/i,
  /\b\d{2,}\s*(partners?|vendors?|companies)/i, // "147 partners"
  /third.?part(y|ies)/i,
  /data processing/i,
  /non-?essential/i, // Vague term
  /personali[sz]ed (ads|content|experience)/i,
];

const DOUBLE_NEGATIVE_PATTERNS = [
  /don'?t\s+(opt out|reject|decline)/i,
  /not\s+disagree/i,
  /un-?opt/i,
  /disable\s+non/i,
  /without\s+not/i,
];

const FALSE_URGENCY_PATTERNS = [
  /act now/i,
  /limited time/i,
  /hurry/i,
  /don'?t wait/i,
  /expires? (soon|today)/i,
];

// Points for each pattern type
const PATTERN_POINTS: Record<DetectedPattern["type"], number> = {
  guilt_trip: 15,
  confusing_terms: 10,
  double_negative: 20,
  false_urgency: 10,
  hidden_reject: 15,
};

/**
 * Analyze text for cognitive friction patterns
 */
export function analyzeCognitiveFriction(text: string): CognitiveFrictionResult {
  if (!text || text.trim().length === 0) {
    return { score: 0, patterns: [] };
  }

  const patterns: DetectedPattern[] = [];

  // Check each pattern category
  for (const pattern of GUILT_TRIP_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      patterns.push({
        type: "guilt_trip",
        match: match[0],
        points: PATTERN_POINTS.guilt_trip,
      });
    }
  }

  for (const pattern of CONFUSING_TERMS_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      patterns.push({
        type: "confusing_terms",
        match: match[0],
        points: PATTERN_POINTS.confusing_terms,
      });
    }
  }

  for (const pattern of DOUBLE_NEGATIVE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      patterns.push({
        type: "double_negative",
        match: match[0],
        points: PATTERN_POINTS.double_negative,
      });
    }
  }

  for (const pattern of FALSE_URGENCY_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      patterns.push({
        type: "false_urgency",
        match: match[0],
        points: PATTERN_POINTS.false_urgency,
      });
    }
  }

  // Calculate score (capped at 100)
  const totalPoints = patterns.reduce((sum, p) => sum + p.points, 0);
  const score = Math.min(100, totalPoints);

  return { score, patterns };
}

/**
 * Check if reject is hidden (styled as link vs button)
 * Returns points if hidden, 0 otherwise
 */
export function checkHiddenReject(
  hasRejectButton: boolean,
  rejectIsLink: boolean
): DetectedPattern | null {
  if (!hasRejectButton) return null;
  if (rejectIsLink) {
    return {
      type: "hidden_reject",
      match: "Reject styled as link instead of button",
      points: PATTERN_POINTS.hidden_reject,
    };
  }
  return null;
}

/**
 * Calculate click asymmetry score
 * 0 = symmetric, 100 = maximum asymmetry
 */
export function calculateClickAsymmetry(
  acceptClicks: number | undefined,
  rejectClicks: number | undefined
): number {
  if (acceptClicks === undefined || rejectClicks === undefined) {
    return 0;
  }

  if (acceptClicks === 0 && rejectClicks === 0) {
    return 0;
  }

  // If reject requires more clicks than accept, that's friction
  const diff = rejectClicks - acceptClicks;
  if (diff <= 0) return 0;

  // Scale: 1 extra click = 33, 2 extra = 66, 3+ = 100
  return Math.min(100, diff * 33);
}

/**
 * Calculate overall friction score
 * Weighted combination of all friction types
 */
export function calculateFrictionScore(
  acceptClicks: number | undefined,
  rejectClicks: number | undefined,
  visualAsymmetry: number,
  cognitiveResult: CognitiveFrictionResult
): FrictionScore {
  const clickAsymmetry = calculateClickAsymmetry(acceptClicks, rejectClicks);

  // Weights: click 40%, visual 30%, cognitive 30%
  const overall = Math.round(
    clickAsymmetry * 0.4 +
    visualAsymmetry * 0.3 +
    cognitiveResult.score * 0.3
  );

  return {
    overall,
    clickAsymmetry,
    visualAsymmetry,
    cognitive: cognitiveResult.score,
  };
}

/**
 * Generate findings from friction analysis
 */
export function generateFrictionFindings(
  frictionScore: FrictionScore,
  cognitiveResult: CognitiveFrictionResult
): Array<{
  id: string;
  title: string;
  severity: "info" | "warn" | "fail";
  category: "dark-pattern";
  detail: string;
  evidence?: { kind: "text"; value: string };
}> {
  const findings: Array<{
    id: string;
    title: string;
    severity: "info" | "warn" | "fail";
    category: "dark-pattern";
    detail: string;
    evidence?: { kind: "text"; value: string };
  }> = [];

  // Overall friction finding
  if (frictionScore.overall >= 61) {
    findings.push({
      id: "friction.overall.high",
      title: `High friction score: ${frictionScore.overall}/100`,
      severity: "fail",
      category: "dark-pattern",
      detail: "The consent interface creates significant friction for users who want to reject tracking. This may violate GDPR requirements for freely given consent.",
    });
  } else if (frictionScore.overall >= 31) {
    findings.push({
      id: "friction.overall.moderate",
      title: `Moderate friction score: ${frictionScore.overall}/100`,
      severity: "warn",
      category: "dark-pattern",
      detail: "The consent interface creates some friction for users who want to reject tracking. Consider making reject options equally accessible.",
    });
  }

  // Cognitive pattern findings
  const guiltTrips = cognitiveResult.patterns.filter(p => p.type === "guilt_trip");
  if (guiltTrips.length > 0) {
    findings.push({
      id: "friction.cognitive.guilt_trip",
      title: "Guilt-tripping language detected",
      severity: "warn",
      category: "dark-pattern",
      detail: "The consent banner uses emotional manipulation to discourage rejection.",
      evidence: { kind: "text", value: guiltTrips.map(p => p.match).join(", ") },
    });
  }

  const confusing = cognitiveResult.patterns.filter(p => p.type === "confusing_terms");
  if (confusing.length > 0) {
    findings.push({
      id: "friction.cognitive.confusing",
      title: "Confusing terminology detected",
      severity: "warn",
      category: "dark-pattern",
      detail: "The consent banner uses vague or technical language that may confuse users.",
      evidence: { kind: "text", value: confusing.map(p => p.match).join(", ") },
    });
  }

  const doubleNeg = cognitiveResult.patterns.filter(p => p.type === "double_negative");
  if (doubleNeg.length > 0) {
    findings.push({
      id: "friction.cognitive.double_negative",
      title: "Double negative language detected",
      severity: "fail",
      category: "dark-pattern",
      detail: "The consent banner uses confusing double negatives that obscure user choice.",
      evidence: { kind: "text", value: doubleNeg.map(p => p.match).join(", ") },
    });
  }

  const urgency = cognitiveResult.patterns.filter(p => p.type === "false_urgency");
  if (urgency.length > 0) {
    findings.push({
      id: "friction.cognitive.urgency",
      title: "False urgency language detected",
      severity: "warn",
      category: "dark-pattern",
      detail: "The consent banner creates artificial time pressure.",
      evidence: { kind: "text", value: urgency.map(p => p.match).join(", ") },
    });
  }

  const hidden = cognitiveResult.patterns.filter(p => p.type === "hidden_reject");
  if (hidden.length > 0) {
    findings.push({
      id: "friction.cognitive.hidden_reject",
      title: "Reject option visually de-emphasized",
      severity: "warn",
      category: "dark-pattern",
      detail: "The reject option is styled as a link rather than a button, making it less prominent.",
    });
  }

  return findings;
}
