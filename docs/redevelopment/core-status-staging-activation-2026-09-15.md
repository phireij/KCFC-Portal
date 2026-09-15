# KCFC Portal — Core-status staging activation handoff — 2026-09-15

## Source of truth

- Repository: `phireij/KCFC-Portal`
- Branch: `redesign/mobile-first-v2`
- Starting implementation head before this handoff document: `03ab4aca62d0436af24f1d40ee85e5d456bda628`
- Draft PR: #1 — must remain OPEN / DRAFT / NOT MERGED
- Production `main`: `653cc7229600fd7baff17a21a21f12d267b66d2b` — must remain untouched
- Exact-head CI for `03ab4aca62d0436af24f1d40ee85e5d456bda628`: KCFC Redevelopment CI #1994 / run `34953458196` — SUCCESS

This handoff is for isolated Firebase/App Hosting staging only. It does not authorize production deployment, production Core-status changes, production data mutation, PR merge, connector activation, or Firebase Auth account recreation.

## Repository state ready for staging

The Governed Member Editing workspace now contains a separate Membership Status control for Regular Member ↔ Core Member transitions.

The server-side transition route:

- accepts authenticated requests only;
- derives actor identity from a verified Firebase ID token;
- authorizes active Admin/President actors only;
- restricts the target to an active verified non-Admin member;
- rebuilds the transition plan from canonical Firestore data;
- rejects stale `updatedAt` preconditions;
- hard-blocks any runtime other than `staging`;
- requires explicit `KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=true`;
- atomically updates `users/{uid}` and `member_directory/{uid}` and appends `leadership_audit` evidence;
- preserves the Firebase Auth account and UID;
- returns sanitized generic errors for unexpected provider/runtime failures.

Regular → Core expands eligibility only and grants no role or ministry automatically.

Core → Regular preserves the permanent Member role and otherwise-valid liturgical ministries, while removing Core-only organizational roles, Kitchen/Cleaning membership, and cleaning-status markers according to the governed transition plan.

## Important Web Push correction for current staging preflight

Use the repository's current `scripts/staging-preflight.mjs` as the authoritative contract.

The Firebase FCM browser VAPID public key and the native Web Push server VAPID public key must be **distinct**. Do not configure them as the same key.

Required shape:

```text
VITE_FCM_VAPID_KEY=<Firebase/FCM browser public VAPID key>
WEB_PUSH_VAPID_PUBLIC_KEY=<dedicated native Web Push staging public key>
WEB_PUSH_VAPID_PRIVATE_KEY=<matching dedicated native Web Push staging private key, server-only>
```

Never expose or copy the private key into screenshots, logs, PR text, browser code, or chat.

## Work-mode execution sequence

Use the already-provisioned isolated KCFC Firebase/App Hosting staging environment. Do not create a replacement environment unless the existing one is unavailable or demonstrably unsafe.

1. Verify the live branch head and Draft PR #1 first. Use the newest exact head only after its CI is green.
2. Confirm the staging Firebase project, App Hosting backend, generated staging URL, and Firestore database are the same isolated resources that passed the prior staging-acceptance checkpoint. Stop if production/default project identity appears.
3. Configure the deployment from the exact current branch head with the existing staging environment values. Keep all external connector flags false.
4. For the first deployment of the new code, keep `KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=false` and run the real staging preflight/build/deploy. This proves the new bundle before enabling any write path.
5. Verify the deployed UI still shows `Staging • Test environment` and `GET /api/health` returns HTTP success, `status: "ok"`, `runtime: "staging"`, the expected isolated Firebase project ID, and expected Firestore database ID, with no secrets exposed.
6. Verify the Governed Member Editing page visibly contains the Membership Status control. With the executor still false, a status mutation must remain unavailable at the server boundary.
7. Only after steps 1–6 pass, change **only the isolated staging environment** setting `KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=true` and roll out a new staging revision. Keep production unchanged.
8. Repeat staging badge and `/api/health` verification after the flag-only rollout.
9. Verify the route remains authenticated and role-gated. Do not use production accounts/data and do not modify an actual KCFC member merely to obtain evidence.
10. Empirical mutation acceptance may use only an already-approved staging test identity/data set. If no suitable staging-only target exists, stop before mutation rather than creating synthetic accounts or altering real member records without explicit approval.
11. If an approved staging-only target exists, test Regular → Core, Core → Regular cleanup, stale-plan rejection, unauthorized-actor rejection, public member-directory synchronization, and exactly-one audit event per committed transition.
12. Record non-secret evidence only: deployed SHA, rollout/revision, staging project/backend/URL, `/api/health`, flag state, PASS/FAIL matrix, and any remediation commit. Never record ID tokens, passwords, private VAPID material, FCM tokens, PushSubscription endpoints, or personal data.

## Acceptance expectations

### Regular → Core

- `isCoreMember` becomes true.
- Existing roles and ministries remain unchanged.
- No Core-only role/ministry is granted automatically.
- `member_directory/{uid}.isCoreMember` becomes true in the same transaction boundary.
- Exactly one `leadership_audit` record is appended.
- Auth UID/account remains unchanged.

### Core → Regular

- `isCoreMember` becomes false.
- Non-Member organizational roles are removed according to the governed plan.
- Kitchen/Cleaning and cleaning-status assignments are removed.
- Otherwise-valid liturgical ministries are preserved.
- Public directory projection reflects the resulting status/roles/ministries atomically.
- Exactly one audit record is appended.
- Auth UID/account remains unchanged.

### Rejection cases

- non-staging runtime → denied;
- executor flag false → denied;
- unauthenticated caller → denied;
- non-Admin/non-President actor → denied;
- inactive actor → denied;
- Admin target → denied;
- inactive/unverified target → denied;
- no-op target status → denied;
- stale reviewed revision → denied without mutation.

## Stop conditions

Stop immediately and do not improvise if any of the following occurs:

- production Firebase project/default production identity appears;
- production member data is visible in staging;
- Draft PR #1 is no longer draft/open or `main` has moved unexpectedly;
- external connectors become enabled;
- staging preflight fails;
- `/api/health` does not identify the isolated staging runtime/project/database;
- the deployed revision does not correspond to the exact intended branch SHA;
- the mutation route appears reachable in production;
- safe empirical testing would require creating a new identity or modifying a real member without explicit approval.

## Post-activation posture

After acceptance, keep the executor enabled only as long as needed for staging QA. Production remains hard-blocked by runtime checks and is not authorized for Core-status mutation. A separate explicit approval is required before any future production-capable promotion.
