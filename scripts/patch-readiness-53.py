from pathlib import Path

# Production readiness
path = Path('docs/redevelopment/production-readiness-evidence-2026-09-11.md')
text = path.read_text()
text = text.replace(
    '- member governance, pre-registration safety, pre-registration email-verification migration and account-status classification;',
    '- member governance, pre-registration safety, pre-registration email-verification migration, Login email-verification migration safety and account-status classification;'
)
text = text.replace(
    '- leadership accessibility;',
    '- leadership accessibility and URL-backed Leadership workspace history navigation;'
)
old = 'Latest validated code checkpoint: `470cad404e112c3a4b0afe3fd76a8257ac049a44`, `KCFC Redevelopment CI` run **#1043** / id `34576876886`, conclusion **SUCCESS**. All **51** validation/build/security steps passed.'
new = 'Latest validated code checkpoint: `3e37e3e9aed6d4cd9577711e3c7c828e2b845d96`, `KCFC Redevelopment CI` run **#1071** / id `34578065249`, conclusion **SUCCESS**. All **53** validation/build/security steps passed.'
if old not in text:
    raise SystemExit('production readiness checkpoint marker not found')
text = text.replace(old, new)
text = text.replace(
    'The onboarding regression previously fixed remains covered: a pending pre-registered member is not automatically marked email-verified merely because the pending profile exists. Bootstrap admin remains the explicit exception; otherwise migration respects Firebase Auth `emailVerified` or an already-true pending value.',
    'Email-verification migration is now guarded in both authenticated bootstrap migration and the Login/Google profile creation path: a pending profile or newly created profile cannot be marked email-verified by an unconditional fallback. Bootstrap admin remains the explicit exception; otherwise migration respects Firebase Auth `emailVerified` or an already-true pending value.'
)
path.write_text(text)

# Staging checklist
path = Path('docs/redevelopment/staging-readiness-checklist.md')
text = path.read_text()
text = text.replace(
    '- [x] Notification-linked Updates, Inbox filters/history, member/leader availability-request deep links, Resources category history, Community filter history, and Updates scope history are covered by permanent automated guards.',
    '- [x] Notification-linked Updates, Inbox filters/history, member/leader availability-request deep links, Resources category history, Community filter history, Updates scope history, and Leadership workspace URL/history navigation are covered by permanent automated guards.\n- [x] Login/Google profile creation preserves real email-verification state; forced-true verification fallbacks are prohibited by CI.'
)
old = 'Latest exact-head automated evidence before this checklist update: code head `470cad404e112c3a4b0afe3fd76a8257ac049a44`, `KCFC Redevelopment CI` run **#1043** / id `34576876886`, conclusion **SUCCESS**, with all **51** validation/build/security steps green. This includes staging-only environment identification, Schedule URL/history navigation, full-URL same-origin notification tap handling, Updates focus + Published/All scope history, Inbox deep-link/history/filter navigation, Resources category history, Community member-type/ministry history, availability member/leader deep-link focus, Home explicit-roster publication privacy, staging isolation/preflight, and the existing governance/build guards.'
new = 'Latest exact-head automated evidence before this checklist update: code head `3e37e3e9aed6d4cd9577711e3c7c828e2b845d96`, `KCFC Redevelopment CI` run **#1071** / id `34578065249`, conclusion **SUCCESS**, with all **53** validation/build/security steps green. This includes Login email-verification migration safety, Leadership workspace URL/history navigation, staging-only environment identification, Schedule URL/history navigation, full-URL same-origin notification tap handling, Updates focus/scope history, Inbox deep-link/history/filter navigation, Resource/Community history navigation, availability member/leader deep-link focus, Home explicit-roster publication privacy, staging isolation/preflight, and the existing governance/build guards.'
if old not in text:
    raise SystemExit('staging checklist checkpoint marker not found')
text = text.replace(old, new)
text = text.replace(
    '- [ ] pending profile migrates to the real Firebase UID without Auth user recreation.',
    '- [ ] pending profile migrates to the real Firebase UID without Auth user recreation.\n- [ ] Login/Google profile creation does not set `isEmailVerified=true` unless bootstrap-admin exception, Firebase Auth verification, or a previously true pending verification state justifies it.'
)
path.write_text(text)

# Staging matrix
path = Path('docs/redevelopment/staging-test-matrix.md')
text = path.read_text()
text = text.replace(
    '| AUTH-03 | STG_DISABLED | Sign in | Disabled account cannot use protected Portal |',
    '| AUTH-03 | STG_DISABLED | Sign in | Disabled account cannot use protected Portal |\n| AUTH-04 | STG_PENDING | First Login/Google profile migration with email still unverified | Real Firebase UID is preserved, but profile email-verification remains false unless Firebase Auth/pending evidence says otherwise |'
)
text = text.replace(
    '| ADMIN-08 | STG_ADMIN | Inspect routine Member Administration and Website Inquiry surfaces | Account disabling, member deletion, credential purge and Core-status mutation controls are absent from the routine focused surfaces |',
    '| ADMIN-08 | STG_ADMIN | Inspect routine Member Administration and Website Inquiry surfaces | Account disabling, member deletion, credential purge and Core-status mutation controls are absent from the routine focused surfaces |\n| ADMIN-09 | STG_ADMIN | Open `/admin?view=inquiries`, `/admin?view=broadcast`, `/admin?view=members`, and `/admin?view=advanced`; then use Back/Forward | Authorized workspace follows the `view` query and browser history; invalid values fall back to Overview; unauthorized users remain denied |'
)
path.write_text(text)
