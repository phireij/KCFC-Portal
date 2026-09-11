from pathlib import Path

server = Path('server.ts')
s = server.read_text()
old = '''    // Unified server-side diagnostic logging of incoming public inquiries\n    const inboundHeaders = JSON.stringify(req.headers);\n    const inboundBody = JSON.stringify(req.body);\n    const inboundQuery = JSON.stringify(req.query);\n    logMessage(`[INBOUND CONTACT] Received request. Headers: ${inboundHeaders} | Body: ${inboundBody} | Query: ${inboundQuery}`);\n'''
new = '''    // Privacy-safe request metadata only. Never persist raw headers/body/query for public inquiries.\n    const inboundBodyFieldCount = req.body && typeof req.body === "object" ? Object.keys(req.body).length : 0;\n    const inboundQueryFieldCount = req.query && typeof req.query === "object" ? Object.keys(req.query).length : 0;\n    logMessage(`[INBOUND CONTACT] Received request. method=${req.method} contentType=${req.get("content-type") || "unknown"} bodyFields=${inboundBodyFieldCount} queryFields=${inboundQueryFieldCount}`);\n'''
if old not in s:
    raise SystemExit('raw inquiry request logging marker missing')
s = s.replace(old, new, 1)
server.write_text(s)

verifier = Path('scripts/verify-inquiry-privacy-logging.ts')
v = verifier.read_text()
v = v.replace("  'errorDetails: errorDetails || undefined',\n", "  'errorDetails: errorDetails || undefined',\n  'const inboundHeaders = JSON.stringify(req.headers);',\n  'const inboundBody = JSON.stringify(req.body);',\n  'const inboundQuery = JSON.stringify(req.query);',\n  'Headers: ${inboundHeaders} | Body: ${inboundBody} | Query: ${inboundQuery}',\n")
v = v.replace("  'res.json({ success: true, emailSent, firestoreWritten });',\n", "  'res.json({ success: true, emailSent, firestoreWritten });',\n  'bodyFields=${inboundBodyFieldCount} queryFields=${inboundQueryFieldCount}',\n")
verifier.write_text(v)
