from pathlib import Path

path = Path('server.ts')
source = path.read_text()

old_auth = 'logMessage(`[PROCESS] Caller UID verified: "${callerUid}" | Email: "${callerEmail}"`);'
new_auth = 'logMessage(`[PROCESS] Caller Firebase ID token verified.`);'
count_auth = source.count(old_auth)
if count_auth != 4:
    raise SystemExit(f'Expected 4 caller identity log statements, found {count_auth}')
source = source.replace(old_auth, new_auth)

old_failed = 'emailLogMessage = `[SMTP SUCCESS] Finished personalized email dispatch. Sent: ${successCount}, Failed: ${failCount}.${failCount > 0 ? ` Failed recipients: ${failedRecipients.join(", ")}` : ""}`;'
new_failed = 'emailLogMessage = `[SMTP SUCCESS] Finished personalized email dispatch. Sent: ${successCount}, Failed: ${failCount}.`;'
count_failed = source.count(old_failed)
if count_failed != 2:
    raise SystemExit(f'Expected 2 recipient-address log statements, found {count_failed}')
source = source.replace(old_failed, new_failed)

path.write_text(source)
