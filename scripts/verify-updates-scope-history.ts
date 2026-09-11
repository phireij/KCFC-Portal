import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Announcements.tsx', 'utf8');

const required = [
  'const [searchParams, setSearchParams] = useSearchParams();',
  "const requestedScope = searchParams.get('scope');",
  "const scope: 'published' | 'all' = canCreate && requestedScope === 'all' ? 'all' : 'published';",
  "if (nextScope === 'all') next.set('scope', 'all');",
  "else next.delete('scope');",
  "onClick={() => setScopeFilter('published')}",
  "onClick={() => setScopeFilter('all')}",
  "const focusedAnnouncementId = searchParams.get('id');",
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Missing Updates scope history marker: ${marker}`);
  }
}

if (source.includes("const [scope, setScope] = useState<'published' | 'all'>('published')")) {
  throw new Error('Updates scope must not regress to local-only state');
}

if (!source.includes("const [queryText, setQueryText] = useState('')")) {
  throw new Error('Updates text search should remain local to avoid per-keystroke history entries');
}

console.log('Updates scope URL/history navigation: PASS');
