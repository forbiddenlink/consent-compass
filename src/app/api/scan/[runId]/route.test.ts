import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from './route'
import { getDb, closeDb } from '@/lib/db'

vi.mock('@trigger.dev/sdk/v3', () => ({
  tasks: { trigger: vi.fn() },
  runs: { retrieve: vi.fn() },
}))
import { runs } from '@trigger.dev/sdk/v3'
const mockRetrieve = vi.mocked(runs.retrieve)

const RUN = 'run_abc12345xyz'
const call = (id = RUN) =>
  GET(new Request(`http://localhost/api/scan/${id}`), { params: Promise.resolve({ runId: id }) })

function okResult() {
  return {
    status: 'ok',
    url: 'https://example.com/',
    scannedAt: '2026-11-17T00:00:00.000Z',
    score: { overall: 77, choiceSymmetry: 1, preConsentSignals: 1, accessibility: 1, transparency: 1 },
    banner: { detected: true, confidence: 1, selectors: [], acceptButtons: [], rejectButtons: [], managePrefsButtons: [] },
    friction: {},
    preConsent: { cookies: [], requests: [] },
    artifacts: {},
    findings: [],
    meta: { userAgent: 't', tookMs: 1, scannerVersion: '1' },
  }
}

const run = (over: Record<string, unknown>) =>
  mockRetrieve.mockResolvedValue({ taskIdentifier: 'scan-url-compliance', ...over } as never)

describe('GET /api/scan/[runId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    closeDb()
  })

  it('rejects a malformed run id without calling Trigger.dev', async () => {
    const res = await call('../etc/passwd')
    expect(res.status).toBe(400)
    expect(mockRetrieve).not.toHaveBeenCalled()
  })

  it.each(['QUEUED', 'DEQUEUED', 'EXECUTING', 'WAITING', 'DELAYED', 'PENDING_VERSION'])(
    'maps %s to pending (202)',
    async (status) => {
      run({ status })
      const res = await call()
      expect(res.status).toBe(202)
      expect((await res.json()).status).toBe('pending')
    },
  )

  it.each(['FAILED', 'CRASHED', 'SYSTEM_FAILURE', 'CANCELED'])(
    'maps %s to an error',
    async (status) => {
      run({ status, error: { message: 'boom' } })
      const res = await call()
      expect(res.status).toBe(500)
      expect((await res.json()).status).toBe('error')
    },
  )

  it('maps EXPIRED to a queue-busy error the UI can show', async () => {
    run({ status: 'EXPIRED' })
    const res = await call()
    const json = await res.json()
    expect(res.status).toBe(503)
    expect(json.code).toBe('QUEUE_BUSY')
    expect(json.error).toBe('Scan queue is busy, try again')
  })

  it('keeps the DNS, refused and timeout error mappings', async () => {
    run({ status: 'FAILED', error: { message: 'page.goto: net::ERR_NAME_NOT_RESOLVED' } })
    expect((await call()).status).toBe(400)
    run({ status: 'FAILED', error: { message: 'net::ERR_CONNECTION_REFUSED' } })
    expect((await call()).status).toBe(502)
    run({ status: 'FAILED', error: { message: 'Timeout 30000ms exceeded' } })
    expect((await call()).status).toBe(504)
  })

  it('rejects a run that belongs to another task', async () => {
    mockRetrieve.mockResolvedValue({ taskIdentifier: 'other-task', status: 'COMPLETED', output: okResult() } as never)
    const res = await call()
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('RUN_NOT_FOUND')
  })

  it('returns 404 when the run does not exist', async () => {
    mockRetrieve.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }))
    expect((await call()).status).toBe(404)
  })

  it('returns the scan result with scanId on success', async () => {
    run({ status: 'COMPLETED', output: okResult() })
    const res = await call()
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.status).toBe('ok')
    expect(json.score.overall).toBe(77)
    expect(typeof json.scanId).toBe('number')
  })

  it('is idempotent: polling a finished run twice saves one row', async () => {
    run({ status: 'COMPLETED', output: okResult() })
    const a = await (await call()).json()
    const b = await (await call()).json()
    expect(b.scanId).toBe(a.scanId)
    const count = getDb().prepare('SELECT COUNT(*) AS n FROM scans WHERE run_id = ?').get(RUN) as { n: number }
    expect(count.n).toBe(1)
  })
})
