import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Members.tsx', 'utf8');

const required = [
  "import { useSearchParams } from 'react-router-dom';",
  'const [searchParams, setSearchParams] = useSearchParams();',
  "const memberTypeParam = searchParams.get('type');",
  "memberTypeParam === 'core' || memberTypeParam === 'regular'",
  "searchParams.getAll('ministry')",
  'const setMemberTypeFilter = (nextType: MemberTypeFilter) =>',
  "if (nextType === 'all') next.delete('type');",
  "else next.set('type', nextType);",
  "next.delete('ministry');",
  "next.append('ministry', ministry);",
  "onClick={() => setMemberTypeFilter('all')}",
  "onClick={() => setMemberTypeFilter('core')}",
  "onClick={() => setMemberTypeFilter('regular')}",
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Missing Community filter history marker: ${marker}`);
  }
}

if (source.includes("const [memberType, setMemberType] = useState<MemberTypeFilter>('all')")) {
  throw new Error('Community member type must not regress to local-only state');
}

if (source.includes('const [selectedMinistries, setSelectedMinistries] = useState<string[]>([])')) {
  throw new Error('Community ministry filters must not regress to local-only state');
}

if (!source.includes("const [searchQuery, setSearchQuery] = useState('')")) {
  throw new Error('Community free-text search should remain local to avoid per-keystroke history entries');
}

console.log('Community filter URL/history navigation: PASS');
