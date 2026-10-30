import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('shows the lane banner and the nights on disk', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('2026-10-28');
  });

  it('links each night to its digest with line counts', async () => {
    const html = await (await createApp(config).request('/')).text();
    expect(html).toMatch(/<a href="\/digest\/2026-10-28">2026-10-28<\/a>\s*ok 10 · retry 4 · fail 1/);
    expect(html).toMatch(/<a href="\/digest\/2026-10-27">2026-10-27<\/a>\s*ok 7 · retry 0 · fail 0/);
    expect(html.indexOf('2026-10-28')).toBeLessThan(html.indexOf('2026-10-27'));
  });

  it('digest renders 2026-10-28 and 404s a missing night', async () => {
    const ok = await createApp(config).request('/digest/2026-10-28');
    expect(ok.status).toBe(200);
    expect(await ok.text()).toContain('<th>last status</th>');
    const missing = await createApp(config).request('/digest/1999-01-01');
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain('no run log for 1999-01-01');
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});

describe('digest json', () => {
  it('serves the night as the reader returns it', async () => {
    const { readNight } = await import('../src/digest/reader.js');
    const res = await createApp(config).request('/api/digest/2026-10-28');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual(readNight('runs', '2026-10-28'));
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual([
      'digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs',
    ]);
    expect(body.badLines).toBe(1);
  });

  it('404s for a night with no file', async () => {
    const res = await createApp(config).request('/api/digest/1999-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for 1999-01-01' });
  });
});
