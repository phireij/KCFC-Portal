from pathlib import Path

p = Path('docs/redevelopment/production-readiness-evidence-2026-09-11.md')
s = p.read_text()
import re
s = re.sub(r'Latest validated clean branch checkpoint: `[^`]+`, `KCFC Redevelopment CI` run \*\*#\d+\*\* / id `\d+`, conclusion \*\*SUCCESS\*\*\. All \*\*57\*\* validation/build/security steps passed\.', 'Latest validated clean branch checkpoint: `716e920ba685dfab8f9148513847c4f5fc59d517`, `KCFC Redevelopment CI` run **#1247** / id `34586303040`, conclusion **SUCCESS**. All **57** validation/build/security steps passed.', s)
if '- staging verification-email SMTP is suppressed' not in s:
    s = s.replace('- staging public-inquiry notification and authorized inquiry-alert SMTP are suppressed/simulated so QA cannot notify the production KCFC mailbox;\n', '- staging public-inquiry notification and authorized inquiry-alert SMTP are suppressed/simulated so QA cannot notify the production KCFC mailbox;\n- staging verification-email SMTP is suppressed even when SMTP credentials are inherited; the route returns the generated verification link for synthetic onboarding QA instead of sending mail;\n')
p.write_text(s)

p = Path('docs/redevelopment/staging-deployment-runbook-2026-09-11.md')
s = p.read_text()
s = re.sub(r'Latest validated staging-contract checkpoint: `[^`]+`, with `KCFC Redevelopment CI` run \*\*#\d+\*\* / id `\d+` completing successfully with all \*\*57\*\* validation/build/security steps green\.', 'Latest validated staging-contract checkpoint: `716e920ba685dfab8f9148513847c4f5fc59d517`, with `KCFC Redevelopment CI` run **#1247** / id `34586303040` completing successfully with all **57** validation/build/security steps green.', s)
old = 'For baseline staging, the admin mass-email broadcast endpoint remains simulation-only even if SMTP credentials are present. Public-inquiry notification email and the authorized inquiry-alert SMTP endpoint are also suppressed/simulated in staging, so inquiry QA cannot notify the production KCFC mailbox. Inquiry records may still be persisted in the isolated staging Firestore project for workflow testing. Any separately tested reply/verification email flow must use synthetic/test recipients under the applicable approval boundary.'
new = 'For baseline staging, all server SMTP delivery is fail-safe: admin mass-email broadcast is simulation-only; public-inquiry notification email and authorized inquiry-alert SMTP are suppressed/simulated; and custom verification-email SMTP is suppressed even if SMTP credentials are inherited. The verification route still returns the generated verification link when email is not sent, allowing synthetic onboarding QA without external delivery. Inquiry records may still be persisted in the isolated staging Firestore project for workflow testing. Any future real SMTP acceptance test remains a separately approved action using synthetic/test recipients.'
s = s.replace(old, new)
p.write_text(s)
