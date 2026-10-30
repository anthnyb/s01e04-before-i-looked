import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const line = (job: string, status = 'ok') =>
  JSON.stringify({ at: '2026-10-28T23:00:00+01:00', job, status, owner: 'rook' });

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  // Written out of job order on purpose: both routes must sort.
  writeFileSync(join(runsDir, '2026-01-01.jsonl'), [line('zeta/job'), line('alpha/job'), line('mid/job')].join('\n') + '\n');
  writeFileSync(join(runsDir, '2026-01-02.jsonl'), '');
  writeFileSync(join(runsDir, '2026-01-03.jsonl'), [line('good/job'), 'not json at all'].join('\n') + '\n');
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
});

describe('GET /digest/:night', () => {
  it('shows the night as a table of jobs', async () => {
    const res = await app.request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<table');
    expect(html).toContain('alpha/job');
  });

  it('is 404 for a night with no file', async () => {
    expect((await app.request('/digest/2026-02-02')).status).toBe(404);
  });

  it('says "nothing ran" for an empty file', async () => {
    const res = await app.request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still shows the good job when a line did not parse', async () => {
    const res = await app.request('/digest/2026-01-03');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('good/job');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the night with rows sorted by job', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-01-01');
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/job', 'mid/job', 'zeta/job']);
    expect(body.badLines).toBe(0);
  });

  it('is 404 with an error message for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-02-02');
    expect(res.status).toBe(404);
    expect(typeof ((await res.json()) as { error: unknown }).error).toBe('string');
  });

  it('returns no rows for an empty file', async () => {
    const res = await app.request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ rows: [], badLines: 0 });
  });

  it('counts a bad line and keeps the good one', async () => {
    const res = await app.request('/api/digest/2026-01-03');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['good/job']);
  });
});

describe('page and JSON agree', () => {
  it('lists the jobs in the same order', async () => {
    const html = await (await app.request('/digest/2026-01-01')).text();
    const body = (await (await app.request('/api/digest/2026-01-01')).json()) as Night;
    const positions = body.rows.map((r) => html.indexOf(r.job));
    expect(positions.every((i) => i >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
