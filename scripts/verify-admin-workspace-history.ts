import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

const required = [
  "import { useSearchParams } from 'react-router-dom';",
  'const [searchParams, setSearchParams] = useSearchParams();',
  "const requestedView = searchParams.get('view');",
  "workspaceItems.some((item) => item.id === requestedView)",
  "? requestedView as WorkspaceView",
  ": 'overview';",
  "if (nextView === 'overview') next.delete('view');",
  "else next.set('view', nextView);",
  "onClick={() => activateTab(index)}",
  "const canAccess = (profile?.roles || []).some((role) => adminRoles.includes(role));",
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Admin workspace URL/history contract missing: ${marker}`);
  }
}

if (source.includes("const [activeView, setActiveView] = useState<WorkspaceView>('overview')")) {
  throw new Error('Admin workspace must not regress to local-only active-view state');
}

if (!source.includes("if (!canAccess)")) {
  throw new Error('Admin authorization boundary must remain before leadership workspace rendering');
}

console.log('Admin workspace URL/history navigation: PASS');
