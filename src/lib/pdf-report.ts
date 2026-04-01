import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import { createElement } from 'react';
import type { ScanResult, ConsentFinding, Severity } from './types';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: 120,
    fontWeight: 'bold',
  },
  value: {
    flex: 1,
  },
  scoreBox: {
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  scoreLabel: {
    fontSize: 10,
    textAlign: 'center',
    color: '#666',
    marginTop: 4,
  },
  finding: {
    padding: 8,
    marginBottom: 8,
    borderRadius: 4,
  },
  findingFail: {
    backgroundColor: '#fef2f2',
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  findingWarn: {
    backgroundColor: '#fffbeb',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  findingInfo: {
    backgroundColor: '#eff6ff',
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  findingTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  findingDetail: {
    color: '#374151',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
  },
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 6,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableCell: {
    flex: 1,
  },
  tableCellSmall: {
    width: 80,
  },
});

function getSeverityStyle(severity: Severity) {
  switch (severity) {
    case 'fail':
      return styles.findingFail;
    case 'warn':
      return styles.findingWarn;
    default:
      return styles.findingInfo;
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

type ReportProps = {
  result: ScanResult;
  generatedAt?: Date;
};

function ConsentReport({ result, generatedAt = new Date() }: ReportProps) {
  const scoreColor = getScoreColor(result.score.overall);

  return createElement(
    Document,
    {},
    createElement(
      Page,
      { size: 'A4', style: styles.page },
      // Header
      createElement(
        View,
        { style: styles.header },
        createElement(Text, { style: styles.title }, 'Consent Compliance Report'),
        createElement(Text, { style: styles.subtitle }, result.url),
        createElement(
          Text,
          { style: styles.subtitle },
          `Scanned: ${new Date(result.scannedAt).toLocaleString()}`
        )
      ),

      // Overall Score
      createElement(
        View,
        { style: styles.section },
        createElement(Text, { style: styles.sectionTitle }, 'Overall Score'),
        createElement(
          View,
          { style: styles.scoreBox },
          createElement(
            Text,
            { style: { ...styles.scoreValue, color: scoreColor } },
            `${result.score.overall}/100`
          ),
          createElement(Text, { style: styles.scoreLabel }, 'Compliance Score')
        )
      ),

      // Score Breakdown
      createElement(
        View,
        { style: styles.section },
        createElement(Text, { style: styles.sectionTitle }, 'Score Breakdown'),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, 'Choice Symmetry:'),
          createElement(Text, { style: styles.value }, `${result.score.choiceSymmetry}/100`)
        ),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, 'Pre-consent Signals:'),
          createElement(Text, { style: styles.value }, `${result.score.preConsentSignals}/100`)
        ),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, 'Accessibility:'),
          createElement(Text, { style: styles.value }, `${result.score.accessibility}/100`)
        ),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, 'Transparency:'),
          createElement(Text, { style: styles.value }, `${result.score.transparency}/100`)
        )
      ),

      // Banner Detection
      createElement(
        View,
        { style: styles.section },
        createElement(Text, { style: styles.sectionTitle }, 'Banner Analysis'),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, 'Banner Detected:'),
          createElement(Text, { style: styles.value }, result.banner.detected ? 'Yes' : 'No')
        ),
        result.banner.vendor &&
          createElement(
            View,
            { style: styles.row },
            createElement(Text, { style: styles.label }, 'Vendor:'),
            createElement(Text, { style: styles.value }, result.banner.vendor)
          ),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, 'Confidence:'),
          createElement(
            Text,
            { style: styles.value },
            `${Math.round(result.banner.confidence * 100)}%`
          )
        )
      ),

      // Findings
      result.findings.length > 0 &&
        createElement(
          View,
          { style: styles.section },
          createElement(
            Text,
            { style: styles.sectionTitle },
            `Findings (${result.findings.length})`
          ),
          ...result.findings.slice(0, 10).map((finding: ConsentFinding, index: number) =>
            createElement(
              View,
              { key: index, style: { ...styles.finding, ...getSeverityStyle(finding.severity) } },
              createElement(
                Text,
                { style: styles.findingTitle },
                `[${finding.severity.toUpperCase()}] ${finding.title}`
              ),
              createElement(Text, { style: styles.findingDetail }, finding.detail)
            )
          ),
          result.findings.length > 10 &&
            createElement(
              Text,
              { style: { marginTop: 8, fontStyle: 'italic' } },
              `... and ${result.findings.length - 10} more findings`
            )
        ),

      // Footer
      createElement(
        Text,
        { style: styles.footer },
        `Generated by Consent Compass on ${generatedAt.toLocaleString()}`
      )
    )
  );
}

/**
 * Generate a PDF report from scan results using React-PDF.
 */
export async function generateReport(result: ScanResult): Promise<Buffer> {
  const element = createElement(ConsentReport, { result }) as React.ReactElement;
  const buffer = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
  return Buffer.from(buffer);
}

/**
 * Generate a summary PDF for multiple scan results.
 */
export async function generateSummaryReport(
  results: ScanResult[],
  title = 'Consent Compliance Summary'
): Promise<Buffer> {
  const avgScore = results.reduce((sum, r) => sum + r.score.overall, 0) / results.length;
  const passCount = results.filter((r) => r.score.overall >= 80).length;
  const warnCount = results.filter((r) => r.score.overall >= 60 && r.score.overall < 80).length;
  const failCount = results.filter((r) => r.score.overall < 60).length;

  const element = createElement(
    Document,
    {},
    createElement(
      Page,
      { size: 'A4', style: styles.page },
      createElement(
        View,
        { style: styles.header },
        createElement(Text, { style: styles.title }, title),
        createElement(
          Text,
          { style: styles.subtitle },
          `${results.length} sites scanned on ${new Date().toLocaleDateString()}`
        )
      ),

      createElement(
        View,
        { style: styles.section },
        createElement(Text, { style: styles.sectionTitle }, 'Summary'),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, 'Average Score:'),
          createElement(Text, { style: styles.value }, `${Math.round(avgScore)}/100`)
        ),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, 'Passing (80+):'),
          createElement(Text, { style: styles.value }, `${passCount} sites`)
        ),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, 'Warning (60-79):'),
          createElement(Text, { style: styles.value }, `${warnCount} sites`)
        ),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, 'Failing (<60):'),
          createElement(Text, { style: styles.value }, `${failCount} sites`)
        )
      ),

      createElement(
        View,
        { style: styles.section },
        createElement(Text, { style: styles.sectionTitle }, 'Sites'),
        createElement(
          View,
          { style: styles.table },
          createElement(
            View,
            { style: styles.tableHeader },
            createElement(Text, { style: styles.tableCell }, 'URL'),
            createElement(Text, { style: styles.tableCellSmall }, 'Score'),
            createElement(Text, { style: styles.tableCellSmall }, 'Status')
          ),
          ...results.slice(0, 20).map((r, i) =>
            createElement(
              View,
              { key: i, style: styles.tableRow },
              createElement(
                Text,
                { style: styles.tableCell },
                r.url.replace(/^https?:\/\//, '').slice(0, 40)
              ),
              createElement(Text, { style: styles.tableCellSmall }, `${r.score.overall}`),
              createElement(
                Text,
                { style: styles.tableCellSmall },
                r.score.overall >= 80 ? 'Pass' : r.score.overall >= 60 ? 'Warn' : 'Fail'
              )
            )
          )
        )
      ),

      createElement(
        Text,
        { style: styles.footer },
        `Generated by Consent Compass on ${new Date().toLocaleString()}`
      )
    )
  );

  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}

export { ConsentReport };
