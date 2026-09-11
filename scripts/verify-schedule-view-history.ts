import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Duties.tsx', 'utf8');

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

console.log('Schedule subview URL/history contract: PASS');
