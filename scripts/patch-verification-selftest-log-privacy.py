from pathlib import Path

path = Path('server.ts')
source = path.read_text()
replacements = {
    'logMessage(`[WEBPUSH TEST PRUNE] Pruned expired subscriptions for user ${callerUid}`);': 'logMessage(`[WEBPUSH TEST PRUNE] Pruned expired subscriptions for authenticated caller.`);',
    'res.status(500).json({ error: error.message || "Failed to dispatch test push notification" });': 'res.status(500).json({ error: "Failed to dispatch test push notification" });',
    'logMessage(`[SMTP SUCCESS] Sent custom server-side verification link to ${email}`);': 'logMessage(`[SMTP SUCCESS] Custom server-side verification link dispatched.`);',
    'logMsgText = `[SMTP INITIATED] Custom server-side verification link dispatch started for ${email}`;': 'logMsgText = `[SMTP INITIATED] Custom server-side verification link dispatch started.`;',
    'logMsgText = `[SMTP SIMULATION] No server SMTP config found. Raw verification link: ${verificationLink}`;': 'logMsgText = `[SMTP SIMULATION] No server SMTP config found. Verification link generated for authenticated caller without logging the link.`;',
    'res.status(500).json({ error: error.message || "Failed to process verification email dispatch" });': 'res.status(500).json({ error: "Failed to process verification email dispatch" });',
}
for old, new in replacements.items():
    if source.count(old) != 1:
        raise SystemExit(f'Expected exactly one privacy-sensitive onboarding/self-test marker: {old}')
    source = source.replace(old, new, 1)
path.write_text(source)
