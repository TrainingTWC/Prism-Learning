import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Permanently purge workspaces that have sat in "recently deleted" longer
// than WORKSPACE_RETENTION_MS (7 days). The mutation processes one
// workspace per invocation and self-reschedules while there's a backlog —
// this daily tick is the fallback that guarantees the queue is checked even
// when it's empty.
crons.interval(
  'purge expired deleted workspaces',
  { hours: 24 },
  internal.workspaces.purgeExpiredWorkspaces,
  {},
);

export default crons;
