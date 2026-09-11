from pathlib import Path

app_path = Path('src/App.tsx')
app = app_path.read_text()
replacements = [
    (
        'console.log(`Successfully migrated pre-registered pending document ${pendingDocId} to real UID ${authenticatedUser.uid}`);',
        'console.log("Successfully migrated pre-registered pending member profile to the authenticated account.");'
    ),
    (
        'console.warn("User document deleted from Firestore. Force signing out zombie session:", authenticatedUser.uid);',
        'console.warn("User profile was removed from Firestore. Force signing out stale authenticated session.");'
    ),
]
for old, new in replacements:
    if old not in app:
        raise SystemExit(f'missing App diagnostic marker: {old}')
    app = app.replace(old, new, 1)
app_path.write_text(app)

server_path = Path('server.ts')
server = server_path.read_text()
old = '      res.status(500).json({ error: error.message });\n'
new = '      console.error("[ADMIN DIAGNOSTIC LOG READ ERROR] Failed to read diagnostic service logs.", error);\n      res.status(500).json({ error: "Failed to read diagnostic service logs" });\n'
# Scope replacement to read-delete-logs route only.
start = server.index('app.get("/api/admin/read-delete-logs"')
end = server.index('const publicContactUpload = multer(', start)
route = server[start:end]
if old not in route:
    raise SystemExit('missing admin diagnostic raw error response')
route = route.replace(old, new, 1)
server = server[:start] + route + server[end:]
server_path.write_text(server)
