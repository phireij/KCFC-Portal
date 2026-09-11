from pathlib import Path

path = Path('server.ts')
source = path.read_text()
replacements = {
    'res.status(500).json({ error: err.message || "Failed to register web push subscription" });': 'res.status(500).json({ error: "Failed to register web push subscription" });',
    'res.status(500).json({ error: error.message || "Failed to dispatch push notification" });': 'res.status(500).json({ error: "Failed to dispatch push notification" });',
    'res.status(500).json({ error: error.message || "Failed to dispatch custom push notification" });': 'res.status(500).json({ error: "Failed to dispatch custom push notification" });',
}
for old, new in replacements.items():
    if source.count(old) != 1:
        raise SystemExit(f'Expected exactly one notification raw-error response: {old}')
    source = source.replace(old, new, 1)
path.write_text(source)
