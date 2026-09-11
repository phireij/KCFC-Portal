# Dependency Security Triage

Status: active redevelopment security work. This record does **not** authorize production deployment.

## Current measured baseline

The redevelopment CI records a non-blocking runtime dependency audit using:

`npm audit --omit=dev --json`

After the first compatible remediation batch on 2026-09-11 (JST), the measured runtime snapshot is:

- critical: 1
- high: 8
- moderate: 12
- low: 2
- total runtime findings: 23

The normal install audit now reports 24 findings across runtime + development dependencies (1 critical, 9 high, 12 moderate, 2 low).

This is an improvement from the pre-remediation runtime baseline of 27 findings (1 critical, 12 high, 12 moderate, 2 low) and the full-install baseline of 28 findings (1 critical, 13 high, 12 moderate, 2 low). The first batch therefore removed four runtime high-severity findings and four full-install high-severity findings without using forced dependency rewriting.

## First compatible remediation batch

The following direct dependencies were upgraded through supported patch/minor paths and passed TypeScript plus production-build validation before the package/lockfile commit was created:

- `multer`: `^2.2.0` → `^2.3.0`
- `react-router-dom`: `^7.14.2` → `^7.18.3`
- `vite`: `^6.2.0` → `^6.4.3`
- `@vitejs/plugin-react`: `^5.0.4` → `^5.2.0`

The package update also removed the duplicate runtime `vite` declaration and retains Vite only under `devDependencies`.

The detailed runtime audit confirms that the prior `multer`, `react-router`, `react-router-dom`, and `vite` high-severity entries are no longer present after this batch.

## Remaining critical/high runtime package chains

The post-remediation runtime audit still reports these critical/high package entries:

| Package | Severity | Direct dependency | Audit fix available |
| --- | --- | --- | --- |
| `websocket-driver` | critical | no | yes |
| `@grpc/grpc-js` | high | no | yes |
| `browserslist` | high | no | yes |
| `form-data` | high | no | yes |
| `nanoid` | high | no | yes |
| `nodemailer` | high | yes | major update indicated (`10.0.3`) |
| `postcss` | high | no | yes |
| `protobufjs` | high | no | yes |
| `ws` | high | no | yes |

`nodemailer` remains the only directly declared critical/high package in this post-remediation list, and npm reports its available remediation as a major-version transition. The other entries should be traced to their owning direct dependency families before considering overrides or broad lockfile changes.

The same runtime report also shows moderate/other findings including `@babel/core`, `@protobufjs/utf8`, `baseline-browser-mapping`, `body-parser`, `esbuild`, `qs`, and `uuid`. Several are transitive and some remediation paths imply a major `firebase-admin` update, so they remain staged behind critical/high analysis rather than being changed blindly.

## Policy

1. Do **not** run `npm audit fix --force` against this redevelopment branch. Forced dependency rewrites can introduce breaking changes in Firebase, Vite, React, Express, messaging, PWA or server behavior.
2. Triage runtime exposure first. Identify the package/advisory chain for every critical and high runtime finding.
3. Prefer compatible patch/minor upgrades where the package's supported range allows them.
4. Upgrade one dependency family at a time and run the complete KCFC redevelopment CI after each change.
5. For a finding that cannot yet be removed safely, record the affected package, advisory, reachable KCFC code path, practical exposure, compensating control, and planned remediation version/date.
6. Production readiness requires an explicit security review of any remaining critical/high finding; a green functional CI run alone is not sufficient.

## CI behavior

The audit snapshot is intentionally non-blocking during redevelopment so newly disclosed advisories do not stop unrelated implementation work. Critical/high runtime findings are emitted as a visible GitHub Actions warning and summarized in the workflow run, including the affected package entries and whether npm reports a fix path.

This is distinct from the existing hard-fail safety checks for connector defaults, browser-secret exposure, Core-status executor isolation, TypeScript, build, governance, notification routing and accessibility contracts.

## Next remediation sequence

- trace the critical `websocket-driver` package to its owning direct dependency and determine whether a compatible parent update removes it;
- trace `@grpc/grpc-js`, `form-data`, `protobufjs`, and `ws` through Firebase / Google Cloud dependency families before considering a `firebase-admin` major update;
- trace `nanoid`, `postcss`, and `browserslist` to build/runtime ownership and prefer supported parent-package updates over lockfile overrides;
- review `nodemailer` 10 compatibility separately, including transporter API and TypeScript compatibility, before any major-version change;
- assess whether each remaining affected module is reachable in browser, server, build-only, or optional code paths;
- measure the runtime audit after every remediation family rather than assuming transitive fixes;
- only consider overrides or major-version migrations when a supported compatible remediation path is unavailable.

## Release gate

Before requesting production merge/deployment approval:

- runtime audit snapshot must be reviewed;
- no unresolved critical/high issue may be silently accepted;
- any exception must have documented exposure analysis and compensating controls;
- TypeScript, production build and the complete redevelopment regression suite must remain green after remediation.
