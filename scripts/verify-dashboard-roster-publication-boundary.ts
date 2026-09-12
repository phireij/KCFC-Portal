import fs from 'node:fs';

const dashboard = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
const types = fs.readFileSync('src/types.ts', 'utf8');

const requiredTypeMarkers = [
  "rosterPublished?: boolean;",
  "publicationMode?: 'explicit';",
];
for (const marker of requiredTypeMarkers) {
  if (!types.includes(marker)) {
    throw new Error(`Poll publication state type missing: ${marker}`);
  }
}

const requiredDashboardMarkers = [
  'const isDashboardRosterPublished = (poll: Poll) => {',
  "if (poll.publicationMode === 'explicit') return poll.rosterPublished === true;",
  'const rosterPublished = isDashboardRosterPublished(poll);',
  'if (!isDashboardRosterPublished(poll) || !poll.assignments) return;',
];
for (const marker of requiredDashboardMarkers) {
  if (!dashboard.includes(marker)) {
    throw new Error(`Dashboard publication boundary missing: ${marker}`);
  }
}

const unsafeAssignmentPattern = /const completed = poll\.completedAssignments \|\| \[\];\s*const rosterPublished = \['lector', 'altar_server', 'usher'\]\.every/;
if (unsafeAssignmentPattern.test(dashboard)) {
  throw new Error('Dashboard must not infer personal roster visibility from completedAssignments alone.');
}

console.log('Dashboard explicit/legacy roster publication boundary: PASS');
