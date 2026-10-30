import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl into 5 jobs and 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts runs and retries and keeps the last status and error', () => {
    const rows = readNight('runs', '2026-10-28')!.rows;
    expect(rows.find((r) => r.job === 'fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      fails: 0,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      first: '2026-10-29T01:30:00+01:00',
      last: '2026-10-29T01:37:00+01:00',
    });
    expect(rows.find((r) => r.job === 'lane/sync')).toMatchObject({
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      lastError: 'lock held',
      first: '2026-10-28T23:00:06+01:00',
      last: '2026-10-29T05:00:04+01:00',
    });
    expect(rows.find((r) => r.job === 'notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps a row whose owner is null', () => {
    const row = readNight('runs', '2026-10-28')!.rows.find((r) => r.job === 'digest/render');
    expect(row).toMatchObject({ owner: null, runs: 1, lastError: null });
  });

  it('returns null for a night with no file, or a name that is not a night', () => {
    expect(readNight('runs', '2026-01-01')).toBeNull();
    expect(readNight('runs', '../package')).toBeNull();
  });

  it('reads an empty file as a night with no rows', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-10-30.jsonl'), '');
    expect(readNight(dir, '2026-10-30')).toEqual({ night: '2026-10-30', rows: [], badLines: 0 });
  });

  it('counts lines that parse as JSON but are not run lines', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(
      join(dir, '2026-10-30.jsonl'),
      [
        '{"at":"2026-10-30T23:00:00+01:00","job":"a","status":"ok","owner":"rook"}',
        '{"at":"2026-10-30T23:00:00+01:00","job":"a","status":"maybe","owner":"rook"}',
        '{"at":"not a time","job":"a","status":"ok","owner":"rook"}',
        '{"at":"2026-10-30T23:00:00+01:00","status":"ok","owner":"rook"}',
        '[]',
        '',
      ].join('\n'),
    );
    const night = readNight(dir, '2026-10-30')!;
    expect(night.badLines).toBe(4);
    expect(night.rows).toHaveLength(1);
  });
});
