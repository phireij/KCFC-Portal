from pathlib import Path

path = Path('server.ts')
source = path.read_text()
replacements = {
    'logMessage(`[FCM TEST PUSH] Dispatching test notification to user ${callerProfile.email || callerUid} with ${realTokens.length} tokens...`);': 'logMessage(`[FCM TEST PUSH] Dispatching caller-bound test notification to ${realTokens.length} registered device token(s)...`);',
    'logMessage(`[WEBPUSH TEST PUSH] Dispatching test notification to user ${callerProfile.email || callerUid} with ${callerWebPushSubs.length} subscriptions...`);': 'logMessage(`[WEBPUSH TEST PUSH] Dispatching caller-bound test notification to ${callerWebPushSubs.length} registered subscription(s)...`);',
}
for old, new in replacements.items():
    if old not in source:
        raise SystemExit(f'self-test identity log marker not found: {old}')
    source = source.replace(old, new)
path.write_text(source)
