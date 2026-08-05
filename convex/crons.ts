import { cronJobs } from 'convex/server';

// DISABLED 2026-07-31 — purgeExpiredWorkspaces ran an unexpected 12+ times
// within ~2 seconds of deploy today and workspaces the user never soft-
// deleted are missing. Root cause not yet confirmed. Do not re-enable until
// the purge logic has been verified safe against real data.
const crons = cronJobs();

export default crons;
