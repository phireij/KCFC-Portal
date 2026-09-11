from pathlib import Path

path = Path('server.ts')
text = path.read_text()
start = text.index('  app.post("/api/public/contact"')
end = text.index('  // Secure API endpoint for client-side triggered email alerts', start)
route = text[start:end]

replacements = [
    ('      let errorDetails = "";\n', ''),
    ('        logMessage(`[WARN] dbAdmin direct write failed, attempting unauthenticated REST API fallback. Error: ${dbErr.message}`);\n        errorDetails += `[dbAdmin Error: ${dbErr.message}]`;\n',
     '        logMessage(`[WARN] dbAdmin direct write failed; attempting Firestore REST fallback.`);\n'),
    ('            const errText = await fsResponse.text();\n            logMessage(`[ERROR] REST API fallback failed: ${errText}`);\n            errorDetails += ` [REST Error: ${errText}]`;\n',
     '            logMessage(`[ERROR] Firestore REST fallback failed with status ${fsResponse.status}.`);\n'),
    ('          logMessage(`[ERROR] REST API fetch failed: ${fsErr.message}`);\n          errorDetails += ` [REST Fetch Error: ${fsErr.message}]`;\n',
     '          logMessage(`[ERROR] Firestore REST fallback request failed.`);\n'),
    ('      logMessage(`[ERROR] Public contact endpoint execution failed: ${err.message}`);\n',
     '      logMessage(`[ERROR] Public contact endpoint execution failed.`);\n'),
]
for old, new in replacements:
    if old not in route:
        raise SystemExit(f'missing public-contact error-log marker: {old!r}')
    route = route.replace(old, new, 1)

text = text[:start] + route + text[end:]
path.write_text(text)
