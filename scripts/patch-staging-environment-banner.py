from pathlib import Path

p = Path('src/components/layout/Navbar.tsx')
s = p.read_text()

old = "import NotificationCenter from '../ui/NotificationCenter';"
new = "import NotificationCenter from '../ui/NotificationCenter';\nimport StagingEnvironmentBanner from './StagingEnvironmentBanner';"
assert s.count(old) == 1, f'import anchor count={s.count(old)}'
s = s.replace(old, new)

old = "  return (\n    <>\n      {/* Desktop sidebar */}"
new = "  return (\n    <>\n      <StagingEnvironmentBanner />\n      {/* Desktop sidebar */}"
assert s.count(old) == 1, f'render anchor count={s.count(old)}'
s = s.replace(old, new)

p.write_text(s)
