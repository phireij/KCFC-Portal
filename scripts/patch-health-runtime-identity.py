from pathlib import Path

path = Path('server.ts')
source = path.read_text()
old = '''  app.get("/api/health", (req, res) => {\n    res.json({ status: "ok", time: new Date().toISOString() });\n  });'''
new = '''  app.get("/api/health", (req, res) => {\n    const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";\n    res.json({\n      status: "ok",\n      time: new Date().toISOString(),\n      runtime: runtimeEnvironment,\n      firebaseProjectId: targetProjectId,\n      firestoreDatabaseId: databaseId,\n    });\n  });'''
if old not in source:
    raise SystemExit('Expected /api/health block not found; refusing to patch')
path.write_text(source.replace(old, new, 1))
