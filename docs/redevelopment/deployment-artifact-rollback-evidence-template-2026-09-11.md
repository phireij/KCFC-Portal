# KCFC Portal — Deployment Artifact & Rollback Evidence Template — 2026-09-11

Status: **blank evidence template only.** Completing this document for a future release does not itself authorize production deployment, rollback, backup, restore, migration, connector activation, or any other approval-gated action.

Use one copy per staging release candidate and, later, per explicitly approved production release.

## 1. Release identity

| Field | Evidence |
| --- | --- |
| Environment | `[staging / production]` |
| Release candidate commit SHA | `[exact SHA]` |
| Pull request | `[PR number/link]` |
| Full CI run | `[run number + run ID + conclusion]` |
| Build timestamp | `[UTC/JST timestamp]` |
| Build/artifact identifier | `[provider artifact/image/revision/version ID]` |
| Artifact checksum/digest, if available | `[digest]` |
| Deployment target/service | `[non-secret provider/service identifier]` |
| Deployment URL/hostname | `[hostname only where appropriate]` |
| Operator | `[name/role]` |
| Explicit approver, when required | `[approval reference]` |

Do not record secrets, private keys, Firebase ID tokens, service-account JSON, push endpoints or FCM tokens here.

## 2. Environment identity

Record names/identifiers only.

| Field | Evidence |
| --- | --- |
| KCFC runtime | `[staging / production]` |
| Firebase project ID | `[project ID]` |
| Firestore database ID | `[(default) / named ID]` |
| Firebase Admin runtime identity | `[service/workload identity name only]` |
| Runtime identity project scope checked | `[PASS/FAIL + evidence ref]` |
| External connector gates | `[OFF / approved subset]` |
| Core-status executor | `[OFF / separately approved staging case]` |
| Web Push VAPID set | `[staging / production identifier only; never key material]` |
| Environment variable inventory captured by name only | `[evidence ref]` |

### Staging-only isolation evidence

For staging releases additionally record:

- `npm run staging:preflight`: `[PASS/FAIL + evidence ref]`
- Staging project differs from committed production/default project: `[PASS/FAIL]`
- `Staging • Test environment` badge visible: `[PASS/FAIL + screenshot ref]`
- No production data observed: `[PASS/FAIL]`

## 3. Current deployed version before change

| Field | Evidence |
| --- | --- |
| Existing deployed commit/artifact | `[identifier]` |
| Existing provider revision/version | `[identifier]` |
| Existing deployment timestamp | `[timestamp]` |
| Existing `/api/health` status | `[PASS/FAIL + timestamp]` |
| Last known-good status confirmed | `[YES/NO + evidence]` |

This is the primary application rollback target unless a different known-good artifact is explicitly selected and documented.

## 4. Last-known-good rollback artifact

| Field | Evidence |
| --- | --- |
| Rollback commit SHA | `[exact SHA]` |
| Rollback build/artifact ID | `[identifier]` |
| Rollback artifact still deployable | `[YES/NO]` |
| Artifact checksum/digest verified, if available | `[PASS/FAIL]` |
| Matching configuration snapshot available | `[YES/NO + evidence ref]` |
| Matching environment variable names documented | `[YES/NO + evidence ref]` |
| Known database compatibility constraints | `[none / describe]` |

**Fail the release gate** if the selected last-known-good application artifact cannot actually be redeployed through the provider's supported mechanism.

## 5. Provider rollback procedure

Document the exact non-secret provider procedure/reference for reverting the application version. Do not place access tokens or credentials in this evidence.

```text
Provider/service:
Rollback mechanism: [revision switch / image redeploy / artifact redeploy / other]
Exact revision/artifact selection method:
Expected command or console procedure reference:
Required operator role:
Expected propagation/restart behavior:
Expected rollback duration/health criteria:
```

The preferred rollback is application/version rollback. Do not prescribe Firestore/Auth restore merely to make an older frontend/server run unless a real incompatibility is proven and separately reviewed.

## 6. Backup/recovery evidence before production release

This section is mandatory before a future production approval request. It may remain `NOT YET CAPTURED` during redevelopment/staging preparation.

| Recovery area | Evidence status | Evidence reference |
| --- | --- | --- |
| Firestore export / provider-supported recovery point | `[NOT YET CAPTURED / PASS]` | `[ref]` |
| Firebase Auth recovery/export evidence appropriate to configured project | `[NOT YET CAPTURED / PASS]` | `[ref]` |
| Hosting/server configuration snapshot | `[NOT YET CAPTURED / PASS]` | `[ref]` |
| Current deployment/revision record | `[NOT YET CAPTURED / PASS]` | `[ref]` |
| Last-known-good application artifact | `[NOT YET CAPTURED / PASS]` | `[ref]` |
| Environment-variable inventory by name only | `[NOT YET CAPTURED / PASS]` | `[ref]` |

Do not run a destructive restore merely to prove that rollback documentation exists. Restore testing, when appropriate, must use an isolated environment or a separately approved recovery exercise.

## 7. Release smoke checks

Record after staging deployment and, only after explicit approval, after a production deployment.

| Check | Result | Evidence/notes |
| --- | --- | --- |
| `/api/health` | `[PASS/FAIL]` | |
| Existing/synthetic user sign-in without UID recreation | `[PASS/FAIL/N/A]` | |
| Home | `[PASS/FAIL]` | |
| Schedule + published roster visibility | `[PASS/FAIL]` | |
| Community Directory private-field boundary | `[PASS/FAIL]` | |
| Updates | `[PASS/FAIL]` | |
| KCFC Inbox | `[PASS/FAIL]` | |
| Leadership authorization | `[PASS/FAIL]` | |
| Accounting authorization/compatibility | `[PASS/FAIL]` | |
| Notification registration health | `[PASS/FAIL]` | |
| No automatic outbound send on page/composer open | `[PASS/FAIL]` | |
| Connector gates in intended state | `[PASS/FAIL]` | |
| Core-status executor in intended state | `[PASS/FAIL]` | |

## 8. Rollback trigger criteria

Before deployment, identify objective triggers. Examples that may justify application rollback include:

- authentication/authorization failure affecting normal members;
- production/staging environment identity mismatch;
- unpublished roster/privacy leakage;
- severe Schedule/Inbox navigation regression;
- widespread notification-registration failure introduced by the release;
- server startup or health failure;
- destructive/admin controls becoming reachable from routine unauthorized surfaces; or
- a material data compatibility regression.

Release-specific triggers:

```text
1.
2.
3.
```

## 9. Rollback execution record

Leave blank unless a rollback is actually executed.

| Field | Evidence |
| --- | --- |
| Rollback initiated | `[timestamp]` |
| Reason/trigger | `[reference]` |
| Explicit approval reference, if required | `[reference]` |
| Artifact/revision restored | `[identifier]` |
| Deployment completed | `[timestamp]` |
| `/api/health` after rollback | `[PASS/FAIL]` |
| Data restore performed | `[NO / separately approved reference]` |
| External connectors remained/returned OFF | `[PASS/FAIL]` |
| Core executor remained/returned OFF | `[PASS/FAIL]` |

## 10. Post-rollback smoke checks

| Check | Result | Notes |
| --- | --- | --- |
| Authentication/UID continuity | `[PASS/FAIL]` | |
| Home | `[PASS/FAIL]` | |
| Schedule/roster visibility | `[PASS/FAIL]` | |
| Community privacy boundary | `[PASS/FAIL]` | |
| Updates/Inbox | `[PASS/FAIL]` | |
| Leadership/accounting gates | `[PASS/FAIL]` | |
| Notification health | `[PASS/FAIL]` | |
| No automatic outbound send | `[PASS/FAIL]` | |
| No staging/synthetic data in production | `[PASS/FAIL/N/A]` | |

## 11. Final disposition

```text
Release result: [accepted / rolled back / blocked]
Outstanding defects:
Follow-up commit/issue references:
Evidence reviewer:
Explicit production approval reference, if applicable:
```

Production release remains blocked unless the required backup/recovery evidence, exact rollback artifact evidence, staging/device acceptance and explicit production approval are all present.
