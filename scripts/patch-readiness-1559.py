from pathlib import Path

path = Path('docs/redevelopment/production-readiness-evidence-2026-09-11.md')
text = path.read_text()

old_checkpoint = "Latest validated clean branch checkpoint: `96dd4257137b595331c5b1346bfe31205c19e6cd`, `KCFC Redevelopment CI` run **#1535** / id `34616084222`, conclusion **SUCCESS**. All **58** named validation/build/security steps passed. The runtime audit remains **0 critical, 0 high, 2 moderate, 0 low**; staging runtime-evidence validation, complete build-artifact manifest/hash coverage, manifest retention and staging client-email isolation all remained green."
new_checkpoint = "Latest validated clean branch checkpoint: `eb0a6bd74e5322d13eacc611a2e3eb6781773990`, `KCFC Redevelopment CI` run **#1559** / id `34617244938`, conclusion **SUCCESS**. All **58** named validation/build/security steps passed. The runtime audit remains **0 critical, 0 high, 2 moderate, 0 low**; staging runtime-evidence validation, complete build-artifact manifest/hash coverage, manifest retention, staging client-email isolation and public-contact ingestion hardening all remained green."
if old_checkpoint not in text:
    raise SystemExit('stale or missing checkpoint marker')
text = text.replace(old_checkpoint, new_checkpoint, 1)

anchor = "- inquiry diagnostics do not persist submitted name/email/message content or raw request headers/body/query, do not log Firestore REST URLs containing API-key query parameters, and public inquiry responses do not return internal backend error detail;"
addition = anchor + "\n- public contact ingestion is field-only and bounded: multipart file uploads are rejected, field count/size and inquiry lengths are constrained, email/header validation is enforced, validation responses are generic, notification HTML escapes inquiry content, and persisted `alertSent` mirrors the actual email-initiation state rather than being forced true;"
if anchor not in text:
    raise SystemExit('missing public inquiry anchor')
text = text.replace(anchor, addition, 1)

path.write_text(text)
