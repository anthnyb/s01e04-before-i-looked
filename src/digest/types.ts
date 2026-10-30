// Plan morning-digest § 1. The contract every part of § 2 builds against; the reader lives
// beside it in src/digest/.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, once it has parsed.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job. Times keep the log's offset; owner stays null here and renders as `—`.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number; // lines logged for this job, retries included
  retries: number; // lines with status `retry`
  fails: number; // lines with status `fail`
  lastStatus: RunStatus;
  lastError: string | null; // most recent `error` for this job, even if a later run was ok
  first: string;
  last: string;
};

export type Night = {
  night: string;
  rows: DigestRow[]; // sorted by job, so the page and the JSON can't disagree on order
  badLines: number; // lines that didn't parse: counted, never thrown
};

// null: no runs/<night>.jsonl on disk (404). An empty file is a Night with no rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
