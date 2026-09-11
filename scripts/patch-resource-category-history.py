from pathlib import Path

p = Path('src/pages/Resources.tsx')
s = p.read_text()

old = "import React, { useEffect, useMemo, useState } from 'react';\nimport { useAuth } from '../App';"
new = "import React, { useEffect, useMemo, useState } from 'react';\nimport { useSearchParams } from 'react-router-dom';\nimport { useAuth } from '../App';"
assert s.count(old) == 1, f'import anchor count={s.count(old)}'
s = s.replace(old, new)

old = "  const { profile, user } = useAuth();\n  const [resources, setResources] = useState<Resource[]>([]);\n  const [loading, setLoading] = useState(true);\n  const [searchText, setSearchText] = useState('');\n  const [category, setCategory] = useState('All');"
new = "  const { profile, user } = useAuth();\n  const [searchParams, setSearchParams] = useSearchParams();\n  const [resources, setResources] = useState<Resource[]>([]);\n  const [loading, setLoading] = useState(true);\n  const [searchText, setSearchText] = useState('');\n  const categoryParam = searchParams.get('category');\n  const category = categories.includes(categoryParam || '') ? categoryParam! : 'All';"
assert s.count(old) == 1, f'state anchor count={s.count(old)}'
s = s.replace(old, new)

old = "  const resetFilters = () => {\n    setCategory('All');\n    setSearchText('');\n  };"
new = "  const setResourceCategory = (nextCategory: string) => {\n    setSearchParams((current) => {\n      const next = new URLSearchParams(current);\n      if (nextCategory === 'All') next.delete('category');\n      else next.set('category', nextCategory);\n      return next;\n    });\n  };\n\n  const resetFilters = () => {\n    setSearchParams((current) => {\n      const next = new URLSearchParams(current);\n      next.delete('category');\n      return next;\n    });\n    setSearchText('');\n  };"
assert s.count(old) == 1, f'reset anchor count={s.count(old)}'
s = s.replace(old, new)

old = "onClick={() => setCategory(item)}"
new = "onClick={() => setResourceCategory(item)}"
assert s.count(old) == 1, f'category click anchor count={s.count(old)}'
s = s.replace(old, new)

p.write_text(s)
