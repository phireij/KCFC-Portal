# Dependency Security Triage

Status: active redevelopment security work. This record does **not** authorize production deployment.

## Current measured baseline

The redevelopment CI now records a non-blocking runtime dependency audit using:

`npm audit --omit=dev --json`

Latest measured runtime snapshot on 2026-09-11 (JST):

- critical: 1
- high: 12
- moderate: 12
- low: 2
- total runtime findings: 27

The normal `npm ci` audit currently reports 28 findings across runtime + development dependencies (1 critical, 13 high, 12 moderate, 2 low). This means the current risk is not limited to development-only tooling and must be resolved or explicitly dispositioned before production readiness.

## Policy

1. Do **not** run `npm audit fix --force` against this redevelopment branch. Forced dependency rewrites can introduce breaking changes in Firebase, Vite, React, Express, messaging, PWA or server behavior.
2. Triage runtime exposure first. Identify the package/advisory chain for every critical and high runtime finding.
3. Prefer compatible patch/minor upgrades where the package's supported range allows them.
4. Upgrade one dependency family at a time and run the complete KCFC redevelopment CI after each change.
5. For a finding that cannot yet be removed safely, record the affected package, advisory, reachable KCFC code path, practical exposure, compensating control, and planned remediation version/date.
6. Production readiness requires an explicit security review of any remaining critical/high finding; a green functional CI run alone is not sufficient.

## CI behavior

The audit snapshot is intentionally non-blocking during redevelopment so newly disclosed advisories do not stop unrelated implementation work. Critical/high runtime findings are emitted as a visible GitHub Actions warning and summarized in the workflow run.

This is distinct from the existing hard-fail safety checks for connector defaults, browser-secret exposure, Core-status executor isolation, TypeScript, build, governance, notification routing and accessibility contracts.

## Next remediation sequence

- capture exact critical/high advisory dependency chains;
- separate directly controlled package upgrades from deep transitive dependencies;
- assess whether each affected module is reachable in browser, server, build-only, or optional code paths;
- prepare the smallest compatible package updates;
- validate regression behavior after every package-family update;
- only consider a major-version migration when a compatible remediation path is unavailable.

## Release gate

Before requesting production merge/deployment approval:

- runtime audit snapshot must be reviewed;
- no unresolved critical/high issue may be silently accepted;
- any exception must have documented exposure analysis and compensating controls;
- TypeScript, production build and the complete redevelopment regression suite must remain green after remediation.
