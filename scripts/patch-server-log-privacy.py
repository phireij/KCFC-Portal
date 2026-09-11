from pathlib import Path

path = Path('server.ts')
source = path.read_text()

old_auth = 'logMessage(`[PROCESS] Caller UID verified: "${callerUid}" | Email: "${callerEmail}"`);'
new_auth = 'logMessage(`[PROCESS] Caller Firebase ID token verified.`);'
count_auth = source.count(old_auth)
if count_auth < 1:
    raise SystemExit('Expected at least one caller identity log statement to replace')
source = source.replace(old_auth, new_auth)
if old_auth in source:
    raise SystemExit('Caller identity log statement remained after replacement')

old_failed = 'emailLogMessage = `[SMTP SUCCESS] Finished personalized email dispatch. Sent: ${successCount}, Failed: ${failCount}.${failCount > 0 ? ` Failed recipients: ${failedRecipients.join(", ")}` : ""}`;'
new_failed = 'emailLogMessage = `[SMTP SUCCESS] Finished personalized email dispatch. Sent: ${successCount}, Failed: ${failCount}.`;'
count_failed = source.count(old_failed)
if count_failed < 1:
    raise SystemExit('Expected at least one failed-recipient address log statement to replace')
source = source.replace(old_failed, new_failed)
if old_failed in source:
    raise SystemExit('Failed-recipient address log statement remained after replacement')

path.write_text(source)
print(f'Replaced {count_auth} caller-identity log statement(s) and {count_failed} recipient-address log statement(s).')
