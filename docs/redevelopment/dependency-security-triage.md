# Dependency Security Triage

Status: active redevelopment security work. This record does **not** authorize production deployment.

## Current measured state — 2026-09-11 JST

The redevelopment CI records a non-blocking runtime dependency audit using:

`npm audit --omit=dev --json`

After the validated compatible + transitive remediation sequence, Nodemailer 10 migration, and Firebase Admin 14 migration, the runtime audit is now:

- critical: 0
- high: 0
- moderate: 3
- low: 1
- total runtime findings: 4

This is a material reduction from the original runtime baseline of 27 findings (1 critical, 12 high, 12 moderate, 2 low), and from the post-Nodemailer state of 10 findings (0 critical, 0 high, 9 moderate, 1 low). No `npm audit fix --force` was used.

The full installed dependency tree immediately after the Firebase Admin 14 migration reports 5 findings (1 high, 3 moderate, 1 low). The remaining high finding is outside the runtime-only audit and belongs to development/tooling rather than the deployed runtime dependency set.

## Remediation sequence completed

### Compatible direct-package batch

The first validated package family update moved:

- `multer` from `^2.2.0` to `^2.3.0`
- `react-router-dom` from `^7.14.2` to `^7.18.3`
- `vite` to `^6.4.3`
- `@vitejs/plugin-react` to `^5.2.0`

The duplicate runtime Vite declaration was removed so Vite remains under development dependencies only.

### Compatible parent-package batch

The next validated package family update moved:

- `firebase` to `^12.19.0`
- `@google/genai` to `^1.52.0`
- `autoprefixer` to `^10.5.6`
- `@tailwindcss/vite` to `^4.3.3`
- `tailwindcss` to `^4.3.3`

This removed vulnerable Firebase, gRPC, WebSocket and build-tool chains while preserving TypeScript and production-build compatibility.

### Non-breaking transitive remediation

A branch-only `npm audit fix --omit=dev` was used without `--force`, followed by restoration of the development dependency set and TypeScript/build validation before the lockfile change was committed.

That step removed the remaining critical `websocket-driver` chain and multiple high-severity transitive findings. After this step the runtime audit was reduced to 11 findings: 1 high, 9 moderate and 1 low. The only remaining runtime high finding was Nodemailer.

### Nodemailer 10 migration

Nodemailer was upgraded from `^8.0.9` to `^10.0.3` in an isolated branch-only probe. The current KCFC server usage is limited to the standard `createTransport(...)` and `sendMail(...)` interfaces used by the authenticated leadership broadcast endpoint. TypeScript and the production build both passed unchanged with Nodemailer 10 before the dependency update was committed.

The post-upgrade runtime audit contained no critical or high findings and 10 total runtime findings.

### Firebase Admin 14 migration

`firebase-admin` was then upgraded from `^13.10.0` to `^14.4.0` in a separately isolated compatibility probe. TypeScript and the production build both passed before the dependency/lockfile update was committed.

This major-version migration removed the remaining vulnerable `@google-cloud/firestore`, `@google-cloud/storage`, `google-gax`, `retry-request`, and `teeny-request` chains reported under Firebase Admin 13. The runtime audit fell from 10 findings to 4 findings while retaining 0 critical and 0 high.

A subsequent non-forced `npm audit fix --omit=dev` was tested again after Firebase Admin 14. npm reported the remaining entries as fixable but made no dependency-file changes and still exited non-zero because the advisories remained. No forced rewrite or override was accepted.

## Remaining runtime findings

The latest measured runtime audit reports exactly four package entries:

| Package | Severity | Context |
| --- | --- | --- |
| `qs` | moderate | Transitive runtime dependency; npm reports a fix path, but a normal non-forced audit fix did not alter the locked tree. |
| `uuid` | moderate | Transitive Google Cloud dependency chain. |
| `gaxios` | moderate | Transitive Google Cloud dependency that currently depends on the affected `uuid` range. |
| `esbuild` | low | `tsx` development-tooling chain; advisory concerns the development server on Windows rather than the deployed KCFC production server. |

The remaining issues are therefore lower severity and materially narrower than the original dependency exposure. They still require explicit exposure/disposition review before production approval.

## Policy

1. Never run `npm audit fix --force` on the redevelopment branch.
2. Prefer supported patch/minor parent updates and validated non-breaking transitive remediation.
3. Major dependency upgrades require an isolated compatibility probe, TypeScript validation, production build validation and the normal redevelopment regression suite before acceptance.
4. Dependency overrides are not introduced solely to make the numeric audit count zero; each override needs ownership/reachability and compatibility evidence.
5. Every remaining finding must be assessed for browser, server, build-only or optional-code reachability.
6. Production readiness is based on reviewed exposure and regression evidence, not only on a green build or a zero audit count.

## CI behavior

The permanent redevelopment workflow records the runtime audit snapshot without blocking unrelated redevelopment work. It now prints every remaining runtime package finding, not only critical/high entries, so the residual moderate/low set stays visible on every run.

Critical/high runtime findings would still produce a visible GitHub Actions warning. With the current dependency state, the runtime audit has no critical/high finding to warn on.

The dependency audit is separate from the hard-fail checks for TypeScript, build, communication routing, liturgical publication, governance, Core-status executor isolation, accessibility, mobile navigation, connector defaults and browser-secret exposure.

## Next security work

- document reachability/exposure for `qs`, `uuid`, `gaxios`, and the `tsx`/`esbuild` development-only path;
- trace the exact owning package versions for `qs` and the Google Cloud `uuid`/`gaxios` chain before considering any targeted override;
- keep the runtime audit visible in every redevelopment CI run so newly disclosed advisories are immediately surfaced;
- continue normal mobile/device and staging regression work while preserving the dependency release gate.

## Release gate

Before requesting production merge/deployment approval:

- the latest runtime audit snapshot must be reviewed;
- any remaining finding must have remediation or exposure/disposition evidence appropriate to its severity;
- TypeScript, production build and the complete redevelopment regression suite must remain green;
- production merge/deployment still requires explicit user approval regardless of audit status.
