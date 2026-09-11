from pathlib import Path
p = Path('server.ts')
s = p.read_text()
needle = '''    const envPublicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "";\n    const envPrivateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY || process.env.VAPID_PRIVATE_KEY || "";\n\n    if (envPublicKey && envPrivateKey) {'''
replacement = '''    const envPublicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "";\n    const envPrivateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY || process.env.VAPID_PRIVATE_KEY || "";\n\n    if (runtimeEnvironment === "staging" && (!envPublicKey || !envPrivateKey)) {\n      throw new Error("KCFC staging safety guard: staging Web Push requires explicit WEB_PUSH_VAPID_PUBLIC_KEY and WEB_PUSH_VAPID_PRIVATE_KEY.");\n    }\n\n    if (envPublicKey && envPrivateKey) {'''
if s.count(needle) != 1:
    raise SystemExit(f'Expected one Web Push env marker, found {s.count(needle)}')
p.write_text(s.replace(needle, replacement))
