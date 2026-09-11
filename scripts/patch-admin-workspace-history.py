from pathlib import Path

path = Path('src/pages/Admin.tsx')
source = path.read_text()

source = source.replace("import React, { useRef, useState } from 'react';", "import React, { useRef } from 'react';\nimport { useSearchParams } from 'react-router-dom';")

old = """export default function Admin() {\n  const { profile } = useAuth();\n  const [activeView, setActiveView] = useState<WorkspaceView>('overview');\n  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);\n  const canAccess = (profile?.roles || []).some((role) => adminRoles.includes(role));\n\n  const activateTab = (index: number, moveFocus = false) => {\n    const normalizedIndex = (index + workspaceItems.length) % workspaceItems.length;\n    setActiveView(workspaceItems[normalizedIndex].id);\n    if (moveFocus) tabRefs.current[normalizedIndex]?.focus();\n  };\n"""

new = """export default function Admin() {\n  const { profile } = useAuth();\n  const [searchParams, setSearchParams] = useSearchParams();\n  const requestedView = searchParams.get('view');\n  const activeView: WorkspaceView = workspaceItems.some((item) => item.id === requestedView)\n    ? requestedView as WorkspaceView\n    : 'overview';\n  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);\n  const canAccess = (profile?.roles || []).some((role) => adminRoles.includes(role));\n\n  const activateTab = (index: number, moveFocus = false) => {\n    const normalizedIndex = (index + workspaceItems.length) % workspaceItems.length;\n    const nextView = workspaceItems[normalizedIndex].id;\n    setSearchParams((current) => {\n      const next = new URLSearchParams(current);\n      if (nextView === 'overview') next.delete('view');\n      else next.set('view', nextView);\n      return next;\n    });\n    if (moveFocus) tabRefs.current[normalizedIndex]?.focus();\n  };\n"""

if old not in source:
    raise SystemExit('Admin workspace state marker not found')

source = source.replace(old, new)
path.write_text(source)
