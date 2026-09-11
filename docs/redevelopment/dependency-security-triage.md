# Dependency Security Triage

Status: active redevelopment security work. This record does **not** authorize production deployment.

## Current measured state — 2026-09-11 JST

The redevelopment CI records a non-blocking runtime dependency audit using:

`npm audit --omit=dev --json`

After the validated compatible + transitive remediation sequence and the separately validated Nodemailer 10 migration, the runtime audit is now:

- critical: 0
- high: 0
- moderate: 9
- low: 1
- total runtime findings: 10

The full installed dependency tree immediately after the Nodemailer migration reports 11 findings (1 high, 9 moderate, 1 low). The remaining high finding is outside the runtime-only audit and therefore belongs to development/tooling rather than the runtime dependency set.

This is a material reduction from the original runtime baseline of 27 findings (1 critical, 12 high, 12 moderate, 2 low). No `npm audit fix --force` was used.

## Remediation sequence completed

### Compatible direct-package batch

The first validated package family update moved:

- `multer` from `^2.2.0` to `^2.3.0`
- `react-router-dom` from `^7.14.2` to `^7.18.3`
- `vite` to `^6.4.3`
- `@vitejs/plugin-react` to `^5.2.0`

The duplicate runtime Vite declaration was removed so Vite remains under development dependencies only.

### Compatible parent-package batch

The second validated package family update moved:

- `firebase` to `^12.19.0`
- `@google/genai` to `^1.52.0`
- `autoprefixer` to `^10.5.6`
- `@tailwindcss/vite` to `^4.3.3`
- `tailwindcss` to `^4.3.3`

This removed additional vulnerable Firebase, gRPC, WebSocket and build-tool chains while preserving TypeScript and production-build compatibility.

### Non-breaking transitive remediation

A branch-only `npm audit fix --omit=dev` was used without `--force`, followed by restoration of the development dependency set and full TypeScript/build validation before the lockfile change was committed.

That step removed the remaining critical `websocket-driver` chain and multiple high-severity transitive findings. After this step the runtime audit was reduced to 11 findings: 1 high, 9 moderate and 1 low. The only remaining runtime high finding was Nodemailer.

### Nodemailer 10 migration

Nodemailer was then upgraded from `^8.0.9` to `^10.0.3` in an isolated branch-only probe. The current KCFC server usage is limited to the standard `createTransport(...)` and `sendMail(...)` interfaces used by the authenticated leadership broadcast endpoint. TypeScript and the production build both passed unchanged with Nodemailer 10 before the dependency update was committed.

The post-upgrade runtime audit contains **no critical or high findings**.

## Remaining findings

The runtime audit currently reports 9 moderate and 1 low finding. The visible remaining chains include:

- `qs` moderate findings;
- `uuid` moderate findings in Firebase Admin / Google Cloud dependency chains; npm indicates that the broad remediation path may require a `firebase-admin` major update;
- an `esbuild` advisory associated with the `tsx` development tooling chain.

These remaining findings are lower severity than the original release-blocking critical/high set, but they still require review before production approval. Major Firebase Admin migration or dependency overrides will not be introduced solely to make the numeric audit count zero without compatibility analysis.

## Policy

1. Never run `npm audit fix --force` on the redevelopment branch.
2. Prefer supported patch/minor parent updates and validated non-breaking transitive remediation.
3. Major dependency upgrades require an isolated compatibility probe, TypeScript validation, production build validation and the normal redevelopment regression suite before acceptance.
4. Every remaining finding must be assessed for browser, server, build-only or optional-code reachability.
5. Production readiness is based on reviewed exposure and regression evidence, not only on a green build or a zero audit count.

## CI behavior

The permanent redevelopment workflow records the runtime audit snapshot without blocking unrelated redevelopment work. Critical/high runtime findings produce a visible GitHub Actions warning and package-chain summary. With the current dependency state, the runtime audit has no critical/high finding to warn on.

The dependency audit is separate from the hard-fail checks for TypeScript, build, communication routing, liturgical publication, governance, Core-status executor isolation, accessibility, mobile navigation, connector defaults and browser-secret exposure.

## Next security work

- complete exposure/disposition notes for the remaining `qs`, `uuid`, `esbuild` and related moderate/low chains;
- evaluate Firebase Admin 14 only as a separately scoped compatibility migration rather than an audit-count shortcut;
- keep the runtime audit visible in every redevelopment CI run so newly disclosed advisories are immediately surfaced;
- continue normal mobile/device and staging regression work while preserving the dependency release gate.

## Release gate

Before requesting production merge/deployment approval:

- the latest runtime audit snapshot must be reviewed;
- any remaining finding must have remediation or exposure/disposition evidence appropriate to its severity;
- TypeScript, production build and the complete redevelopment regression suite must remain green;
- production merge/deployment still requires explicit user approval regardless of audit status.
