from pathlib import Path

p = Path('src/pages/Announcements.tsx')
s = p.read_text()

replacements = {
    "const [searchParams] = useSearchParams();": "const [searchParams, setSearchParams] = useSearchParams();",
    "  const [scope, setScope] = useState<'published' | 'all'>('published');": "  const requestedScope = searchParams.get('scope');",
    "  const canEditOthers = (profile?.roles || []).some((role) => ['admin', 'president'].includes(role));": "  const canEditOthers = (profile?.roles || []).some((role) => ['admin', 'president'].includes(role));\n  const scope: 'published' | 'all' = canCreate && requestedScope === 'all' ? 'all' : 'published';\n\n  const setScopeFilter = (nextScope: 'published' | 'all') => {\n    setSearchParams((current) => {\n      const next = new URLSearchParams(current);\n      if (nextScope === 'all') next.set('scope', 'all');\n      else next.delete('scope');\n      return next;\n    });\n  };",
    "<ScopeButton active={scope === 'published'} onClick={() => setScope('published')} label=\"Published\" /><ScopeButton active={scope === 'all'} onClick={() => setScope('all')} label=\"All + drafts\" />": "<ScopeButton active={scope === 'published'} onClick={() => setScopeFilter('published')} label=\"Published\" /><ScopeButton active={scope === 'all'} onClick={() => setScopeFilter('all')} label=\"All + drafts\" />",
}

for old, new in replacements.items():
    if s.count(old) != 1:
        raise SystemExit(f'Expected exactly one occurrence of {old!r}, found {s.count(old)}')
    s = s.replace(old, new)

p.write_text(s)
