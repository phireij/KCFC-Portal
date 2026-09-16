# KCFC Portal — Firebase Bundle Split Disposition

**Date:** 2026-09-11  
**Branch:** `redesign/mobile-first-v2`  
**Scope:** bundle optimization only  
**Production authority:** none

## Decision

**REJECTED:** manually splitting Firebase internal packages into separate Rollup chunks (`auth`, `firestore`, `messaging`, `storage`, `core`).

The stable strategy remains one `vendor-firebase` cache boundary. The normal Vite chunk-size warning remains enabled; `chunkSizeWarningLimit` is not raised to hide it.

## Stable baseline

Validated before the experiment by `KCFC Redevelopment CI` #850 on head `9eafd9363e0a7be770b283ef3d801c2edd3bb222`:

- JavaScript assets: **49**
- total JavaScript: **2271.3 KiB raw / 614.6 KiB gzip**
- main application entry: **332.1 KiB raw / 103.3 KiB gzip**
- `vendor-firebase`: **819.5 KiB raw / 199.0 KiB gzip**
- `vendor-charts`: **363.2 KiB raw / 108.2 KiB gzip**
- `vendor-motion`: **134.0 KiB raw / 44.2 KiB gzip**

The Firebase vendor chunk exceeds Vite's normal 500 KiB minified warning threshold. That warning is intentionally visible.

## Experiment

Experiment commit: `f6ef2cff0119947f7657561a1854c838c8efe799`  
CI: push run **#856** / id `34570383552` — **SUCCESS**

Firebase was manually split into:

- `vendor-firebase-auth`
- `vendor-firebase-firestore`
- `vendor-firebase-messaging`
- `vendor-firebase-storage`
- `vendor-firebase-core`

Measured result:

- JavaScript assets: **52**
- total JavaScript: **2273.1 KiB raw / 616.5 KiB gzip**
- main application entry: **332.4 KiB raw / 103.4 KiB gzip**
- Firestore chunk: **548.2 KiB raw / 137.3 KiB gzip**
- Firebase core: **113.4 KiB raw / 31.6 KiB gzip**
- Firebase Auth: **125.0 KiB raw / 25.1 KiB gzip**
- Firebase Messaging: **32.8 KiB raw / 6.3 KiB gzip**

The build emitted circular-chunk warnings:

- `vendor-firebase-auth -> vendor-firebase-core -> vendor-firebase-auth`
- `vendor-firebase-core -> vendor-firebase-firestore -> vendor-firebase-core`
- `vendor-firebase-core -> vendor-firebase-messaging -> vendor-firebase-core`

Firestore also remained above the normal 500 KiB threshold.

## Evaluation

The experiment did **not** meet the acceptance criteria:

- total raw JavaScript increased by about **1.8 KiB**;
- total gzip JavaScript increased by about **1.9 KiB**;
- the main entry was effectively unchanged and slightly larger;
- a >500 KiB Firebase-related chunk remained;
- new circular chunk warnings were introduced.

Therefore the apparent Firebase chunk reduction did not represent a useful production optimization.

## Revert

Revert commit: `dcd7f0dc701be97f832c7c69a1fd3ded5b65b320`  
Validation: `KCFC Redevelopment CI` push run **#858** — **SUCCESS**, all 39 validation/build/security steps green.

The branch is back on the stable single `vendor-firebase` strategy.

## Safer future optimization direction

Further Firebase optimization should prefer architectural loading changes rather than forcing tightly coupled internal Firebase modules into independent chunks. Candidate investigations:

1. defer Firebase Messaging code until notification/PWA surfaces actually need it;
2. identify Firestore-heavy route features that can be loaded only when their route/workflow opens;
3. confirm whether any Firebase client SDK surfaces are imported but unused;
4. measure initial-route network requests, not only generated chunk sizes, before accepting another split;
5. retain the standard Vite size warning and CI asset report as objective evidence.

Do not accept a future bundle change unless it is warning-cleaner or materially improves delivered bytes/loading behavior without circular chunks or functional regressions.

## Production boundary

This experiment and its revert were redevelopment-branch-only. They authorize no production merge, deployment, Firebase mutation, messaging, or cutover.
