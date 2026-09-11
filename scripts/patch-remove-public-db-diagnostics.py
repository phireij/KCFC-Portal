from pathlib import Path

path = Path('server.ts')
source = path.read_text()
start_marker = '  app.get("/api/public/db-diagnostics", async (req, res) => {'
end_marker = '  // Secure API endpoint to delete user credentials from Firebase Authentication and cascade-clean up Firestore records'
start = source.find(start_marker)
end = source.find(end_marker)
if start == -1:
    raise SystemExit('Public db diagnostics route start not found')
if end == -1 or end <= start:
    raise SystemExit('Expected secure delete-user route marker after public db diagnostics')
source = source[:start] + end_marker + source[end + len(end_marker):]
if '/api/public/db-diagnostics' in source:
    raise SystemExit('Public db diagnostics route still present after patch')
path.write_text(source)
