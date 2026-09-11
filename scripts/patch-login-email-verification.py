from pathlib import Path

path = Path('src/pages/Login.tsx')
source = path.read_text()

replacements = {
    "isEmailVerified: isBootstrapAdmin || emailVerified || pendingData.isEmailVerified || true,": "isEmailVerified: isBootstrapAdmin || emailVerified || pendingData.isEmailVerified || false,",
    "isEmailVerified: isBootstrapAdmin || emailVerified || true,": "isEmailVerified: isBootstrapAdmin || emailVerified || false,",
}

for old, new in replacements.items():
    if old not in source:
        raise SystemExit(f'Login verification marker not found: {old}')
    source = source.replace(old, new)

path.write_text(source)
