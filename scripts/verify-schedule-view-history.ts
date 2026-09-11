import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Duties.tsx', 'utf8');
const home = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const required = [
  "const [searchParams, setSearchParams] = useSearchParams();",
  "const selectView = (nextView: ScheduleView) => {",
  "setSearchParams((currentParams) => {",
  "nextParams.set('view', nextView);",
  "nextParams.delete('tab');",
  "nextParams.delete('pollId');",
  "onClick={() => selectView('all')}",
  "onClick={() => selectView('mine')}",
  "onClick={() => selectView('manage')}",
  "if (requestedView === 'all' || requestedView === 'mine' || requestedView === 'manage')",
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Schedule history contract missing: ${marker}`);
  }
}

if (/onClick=\{\(\) => setView\('(all|mine|manage)'\)\}/.test(source)) {
  throw new Error('Schedule view buttons must update URL history through selectView, not local state only.');
}

const myAssignmentCard = /label="My next assignment"[\s\S]*?path="\/duties\?view=mine"/;
if (!myAssignmentCard.test(home)) {
  throw new Error('Home My next assignment card must deep-link directly to /duties?view=mine.');
}

console.log('Schedule subview URL/history + Home My Ministry deep-link contract: PASS');
