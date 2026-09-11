from pathlib import Path

p = Path('src/pages/Members.tsx')
s = p.read_text()

old = "import React, { useEffect, useMemo, useState } from 'react';\nimport { collection, onSnapshot } from 'firebase/firestore';"
new = "import React, { useEffect, useMemo, useState } from 'react';\nimport { useSearchParams } from 'react-router-dom';\nimport { collection, onSnapshot } from 'firebase/firestore';"
assert s.count(old) == 1, f'import anchor count={s.count(old)}'
s = s.replace(old, new)

old = "  const [members, setMembers] = useState<UserProfile[]>([]);\n  const [loading, setLoading] = useState(true);\n  const [searchQuery, setSearchQuery] = useState('');\n  const [memberType, setMemberType] = useState<MemberTypeFilter>('all');\n  const [selectedMinistries, setSelectedMinistries] = useState<string[]>([]);\n  const [showFilters, setShowFilters] = useState(false);"
new = "  const [searchParams, setSearchParams] = useSearchParams();\n  const [members, setMembers] = useState<UserProfile[]>([]);\n  const [loading, setLoading] = useState(true);\n  const [searchQuery, setSearchQuery] = useState('');\n  const memberTypeParam = searchParams.get('type');\n  const memberType: MemberTypeFilter = memberTypeParam === 'core' || memberTypeParam === 'regular' ? memberTypeParam : 'all';\n  const selectedMinistries = Array.from(new Set(searchParams.getAll('ministry').filter((id) => ministryOptions.some((option) => option.id === id))));\n  const [showFilters, setShowFilters] = useState(false);"
assert s.count(old) == 1, f'state anchor count={s.count(old)}'
s = s.replace(old, new)

old = "  const toggleMinistry = (id: string) => {\n    setSelectedMinistries((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);\n  };\n\n  const resetFilters = () => {\n    setMemberType('all');\n    setSelectedMinistries([]);\n    setSearchQuery('');\n  };"
new = "  const setMemberTypeFilter = (nextType: MemberTypeFilter) => {\n    setSearchParams((current) => {\n      const next = new URLSearchParams(current);\n      if (nextType === 'all') next.delete('type');\n      else next.set('type', nextType);\n      return next;\n    });\n  };\n\n  const toggleMinistry = (id: string) => {\n    setSearchParams((current) => {\n      const next = new URLSearchParams(current);\n      const valid = Array.from(new Set(next.getAll('ministry').filter((value) => ministryOptions.some((option) => option.id === value))));\n      const ministries = valid.includes(id) ? valid.filter((value) => value !== id) : [...valid, id];\n      next.delete('ministry');\n      ministries.forEach((ministry) => next.append('ministry', ministry));\n      return next;\n    });\n  };\n\n  const resetFilters = () => {\n    setSearchParams((current) => {\n      const next = new URLSearchParams(current);\n      next.delete('type');\n      next.delete('ministry');\n      return next;\n    });\n    setSearchQuery('');\n  };"
assert s.count(old) == 1, f'filter helper anchor count={s.count(old)}'
s = s.replace(old, new)

for old_click, new_click in [
    ("onClick={() => setMemberType('all')}", "onClick={() => setMemberTypeFilter('all')}"),
    ("onClick={() => setMemberType('core')}", "onClick={() => setMemberTypeFilter('core')}"),
    ("onClick={() => setMemberType('regular')}", "onClick={() => setMemberTypeFilter('regular')}"),
]:
    assert s.count(old_click) == 1, f'click anchor {old_click} count={s.count(old_click)}'
    s = s.replace(old_click, new_click)

p.write_text(s)
