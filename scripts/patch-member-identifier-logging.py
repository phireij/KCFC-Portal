from pathlib import Path

path = Path('server.ts')
source = path.read_text()
lines = source.splitlines()

identifier_markers = [
    '${userId}',
    '${targetUserId}',
    '${currentUid}',
    '${emailTrimmed}',
    '${targetUser.uid}',
    '${targetUser.email}',
    '${callerEmail}',
    '${rec.email}',
    '${u.id}',
    '${JSON.stringify(allUidsToDelete)}',
]

changed = 0
for i, line in enumerate(lines):
    if 'logMessage(' not in line and 'console.' not in line:
        continue
    updated = line
    for marker in identifier_markers:
        if marker in updated:
            updated = updated.replace(marker, '[redacted]')
    if updated != line:
        lines[i] = updated
        changed += 1

if changed < 1:
    raise SystemExit('Expected at least one member-identifier diagnostic statement to redact')

result = '\n'.join(lines) + ('\n' if source.endswith('\n') else '')
for marker in identifier_markers:
    for line in result.splitlines():
        if ('logMessage(' in line or 'console.' in line) and marker in line:
            raise SystemExit(f'Member identifier marker remained in diagnostic statement: {marker}')

path.write_text(result)
print(f'Redacted member identifiers from {changed} diagnostic statement(s).')
