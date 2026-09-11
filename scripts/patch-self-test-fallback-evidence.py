from pathlib import Path

server = Path('server.ts')
s = server.read_text()
old = '''        res.json({\n          success: true,\n          isSandboxSimulated: true,\n          message: "A live fallback notification has been dispatched to your In-App Notification Center and native browser alerts.",\n          totalTokens: realTokens.length,\n          successCount: realTokens.length,\n          failureCount: 0,\n          webPushSuccessCount,\n          webPushFailureCount\n        });\n'''
new = '''        res.json({\n          success: false,\n          transportAccepted: false,\n          inboxFallback: true,\n          message: "Native push transport was not confirmed. A fallback notification was stored in the KCFC Inbox instead.",\n          totalTokens: realTokens.length,\n          successCount,\n          failureCount,\n          webPushSuccessCount,\n          webPushFailureCount\n        });\n'''
if old not in s:
    raise SystemExit('self-test fallback response marker missing')
s = s.replace(old, new, 1)
server.write_text(s)

verifier = Path('scripts/verify-self-test-push-boundary.ts')
v = verifier.read_text()
insert = '''\nassert.match(route, /success:\\s*false,[\\s\\S]*transportAccepted:\\s*false,[\\s\\S]*inboxFallback:\\s*true/, 'Inbox fallback must not be reported as native push success.');\nassert.match(route, /Native push transport was not confirmed\\. A fallback notification was stored in the KCFC Inbox instead\\./, 'Fallback response must clearly distinguish Inbox persistence from native push acceptance.');\nassert.doesNotMatch(route, /successCount:\\s*realTokens\\.length/, 'Fallback must not fabricate FCM transport success counts.');\n'''
marker = "assert.match(route, /const savedTokens = callerProfile\\.fcmTokens \\|\\| \\[\\]/, 'Self-test FCM tokens must come from the authenticated caller profile.');\n"
if marker not in v:
    raise SystemExit('self-test verifier insertion marker missing')
v = v.replace(marker, marker + insert, 1)
verifier.write_text(v)
