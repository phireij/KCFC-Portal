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
  "const BroadcastTool = React.lazy(() => import('../components/admin/BroadcastTool'));",
  "const CoreStatusPlanner = React.lazy(() => import('../components/admin/CoreStatusPlanner'));",
  "const LeadershipInquiries = React.lazy(() => import('../components/admin/LeadershipInquiries'));",
  "const MemberAccountOverview = React.lazy(() => import('../components/admin/MemberAccountOverview'));",
  "const MemberApprovalQueue = React.lazy(() => import('../components/admin/MemberApprovalQueue'));",
  "const MemberPreRegistration = React.lazy(() => import('../components/admin/MemberPreRegistration'));",
  "const MemberRoleEditor = React.lazy(() => import('../components/admin/MemberRoleEditor'));",
  "const LegacyAdmin = React.lazy(() => import('./LegacyAdmin'));",
  "<React.Suspense fallback=",
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

const eagerWorkspaceImports = [
  "import BroadcastTool from '../components/admin/BroadcastTool';",
  "import CoreStatusPlanner from '../components/admin/CoreStatusPlanner';",
  "import LeadershipInquiries from '../components/admin/LeadershipInquiries';",
  "import MemberAccountOverview from '../components/admin/MemberAccountOverview';",
  "import MemberApprovalQueue from '../components/admin/MemberApprovalQueue';",
  "import MemberPreRegistration from '../components/admin/MemberPreRegistration';",
  "import MemberRoleEditor from '../components/admin/MemberRoleEditor';",
  "import LegacyAdmin from './LegacyAdmin';",
];

for (const eagerImport of eagerWorkspaceImports) {
  if (source.includes(eagerImport)) {
    throw new Error(`Non-default Leadership workspace must remain lazy-loaded: ${eagerImport}`);
  }
}

console.log('Admin workspace URL/history navigation: PASS');
