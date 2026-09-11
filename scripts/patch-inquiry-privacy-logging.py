from pathlib import Path

p = Path('server.ts')
s = p.read_text()

old = '''    logMessage(`[INBOUND CONTACT] Extracted fields => name: "${name}", email: "${email}", subject: "${subject}", message: "${message.substring(0, 100)}..."`);'''
new = '''    logMessage(`[INBOUND CONTACT] Parsed inquiry fields: name=${name ? "present" : "missing"}, email=${email ? "present" : "missing"}, subject=${subject ? "present" : "missing"}, messageLength=${message.length}`);'''
if old not in s:
    raise SystemExit('inquiry field logging marker missing')
s = s.replace(old, new, 1)

old = '''          logMessage(`[INBOUND CONTACT] POSTing to REST endpoint: ${firestoreUrl}`);'''
new = '''          logMessage(`[INBOUND CONTACT] Attempting Firestore REST fallback write.`);'''
if old not in s:
    raise SystemExit('Firestore REST URL logging marker missing')
s = s.replace(old, new, 1)

old = '''      res.json({ success: true, emailSent, firestoreWritten, errorDetails: errorDetails || undefined });'''
new = '''      res.json({ success: true, emailSent, firestoreWritten });'''
if old not in s:
    raise SystemExit('public inquiry response marker missing')
s = s.replace(old, new, 1)

p.write_text(s)
