import { Resend } from "resend";

let _resend: Resend | null = null;

export function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

/**
 * Send compliance report
 */
export async function sendComplianceReport({
  userEmail,
  siteName,
  complianceScore,
  issues,
}: {
  userEmail: string;
  siteName: string;
  complianceScore: number;
  issues: number;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const resend = getResend();
  if (!resend) {
    return { success: false, error: "Resend API key not configured" };
  }

  const html = `
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <h2>Compliance Report: ${siteName}</h2>
        <p style="font-size: 24px; font-weight: bold; color: #${complianceScore > 75 ? "28a745" : complianceScore > 50 ? "ffc107" : "d32f2f"};">${complianceScore}%</p>
        <p>Issues found: <strong>${issues}</strong></p>
        <p>Review your full report in Consent Compass to see detailed findings and remediation steps.</p>
      </body>
    </html>
  `;

  try {
    const response = await resend.emails.send({
      from: "reports@consent-compass.dev",
      to: userEmail,
      subject: `Compliance Report: ${siteName} (${complianceScore}%)`,
      html,
      text: `Compliance score for ${siteName}: ${complianceScore}% with ${issues} issues.`,
    });

    if (response.error) {
      return { success: false, error: response.error.message };
    }

    return { success: true, id: response.data?.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send report",
    };
  }
}
