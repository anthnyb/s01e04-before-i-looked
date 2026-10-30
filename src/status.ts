import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/reader.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

// Line counts for a night; null when the night can't be read.
export type NightCounts = { ok: number; retry: number; fail: number };
export type NightSummary = { night: string; counts: NightCounts | null };

export function nightCounts(runsDir: string, night: string): NightCounts | null {
  const n = readNight(runsDir, night);
  if (!n) return null;
  const counts = { ok: 0, retry: 0, fail: 0 };
  for (const r of n.rows) {
    counts.retry += r.retries;
    counts.fail += r.fails;
    counts.ok += r.runs - r.retries - r.fails;
  }
  return counts;
}

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => ({ night, counts: nightCounts(config.runsDir, night) })),
  };
}
