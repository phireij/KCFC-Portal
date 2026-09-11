from pathlib import Path

path = Path('docs/redevelopment/production-readiness-evidence-2026-09-11.md')
text = path.read_text()

old_checkpoint = "Latest validated clean branch checkpoint: `8ea202c552d88712ffe34b53e7697caa40b6d6b2`, `KCFC Redevelopment CI` run **#1459** / id `34596788624`, conclusion **SUCCESS**. All **58** named validation/build/security steps passed. The runtime audit is now **0 critical, 0 high, 2 moderate, 0 low**; staging runtime-evidence validation, complete build-artifact manifest/hash coverage and manifest retention all remained green."
new_checkpoint = "Latest validated clean branch checkpoint: `96dd4257137b595331c5b1346bfe31205c19e6cd`, `KCFC Redevelopment CI` run **#1535** / id `34616084222`, conclusion **SUCCESS**. All **58** named validation/build/security steps passed. The runtime audit remains **0 critical, 0 high, 2 moderate, 0 low**; staging runtime-evidence validation, complete build-artifact manifest/hash coverage, manifest retention and staging client-email isolation all remained green."
if old_checkpoint not in text:
    raise SystemExit('stale or missing checkpoint marker')
text = text.replace(old_checkpoint, new_checkpoint, 1)

old_email = "- baseline staging routes for broadcast email, inquiry notification/alert email and custom verification email cannot enter real SMTP delivery while `KCFC_RUNTIME_ENV=staging`."
new_email = "- baseline staging has no live email delivery path: server broadcast/inquiry/verification SMTP is suppressed while `KCFC_RUNTIME_ENV=staging`, and client-side Gmail OAuth/API plus SMTP fallback are suppressed while `VITE_KCFC_RUNTIME_ENV=staging`; the exported Gmail token helper also fails closed before cached-token reuse in staging."
if old_email not in text:
    raise SystemExit('missing staging email marker')
text = text.replace(old_email, new_email, 1)

anchor = "- staging verification-email SMTP is suppressed even when SMTP credentials are inherited; the route returns the generated verification link for synthetic onboarding QA instead of sending mail;"
addition = anchor + "\n- client-side Gmail delivery is also staging-isolated: `sendGmail()` returns a simulation result before OAuth/token/network activity and `getGmailAccessToken()` refuses staging before cached-token reuse;"
if anchor not in text:
    raise SystemExit('missing automated email anchor')
text = text.replace(anchor, addition, 1)

path.write_text(text)
