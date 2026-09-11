from pathlib import Path

server = Path('server.ts')
s = server.read_text()
old = '''    } catch (err: any) {\n      logMessage(`[ERROR] Public contact endpoint execution failed: ${err.message}`);\n      res.status(500).json({ error: err.message || "Failed to process contact inquiry" });\n    }\n'''
new = '''    } catch (err: any) {\n      logMessage(`[ERROR] Public contact endpoint execution failed: ${err.message}`);\n      res.status(500).json({ error: "Failed to process contact inquiry" });\n    }\n'''
if old not in s:
    raise SystemExit('public inquiry outer error response marker missing')
s = s.replace(old, new, 1)
server.write_text(s)

verifier = Path('scripts/verify-inquiry-privacy-logging.ts')
v = verifier.read_text()
if "'res.status(500).json({ error: err.message || \"Failed to process contact inquiry\" });'," not in v:
    v = v.replace("  'Headers: ${inboundHeaders} | Body: ${inboundBody} | Query: ${inboundQuery}',\n", "  'Headers: ${inboundHeaders} | Body: ${inboundBody} | Query: ${inboundQuery}',\n  'res.status(500).json({ error: err.message || \"Failed to process contact inquiry\" });',\n")
if "'res.status(500).json({ error: \"Failed to process contact inquiry\" });'," not in v:
    v = v.replace("  'bodyFields=${inboundBodyFieldCount} queryFields=${inboundQueryFieldCount}',\n", "  'bodyFields=${inboundBodyFieldCount} queryFields=${inboundQueryFieldCount}',\n  'res.status(500).json({ error: \"Failed to process contact inquiry\" });',\n")
verifier.write_text(v)
