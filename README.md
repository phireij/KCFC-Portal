# KCFC Portal

KCFC Portal is the member, ministry, communications, scheduling, leadership and PWA portal for the Koiwa Church Filipino Community.

## Current development status

The active redevelopment work is isolated on `redesign/mobile-first-v2` and tracked in Draft PR #1.

Production `main` is intentionally kept untouched until staging, device, rollback and explicit production-approval gates are satisfied.

## Local development

Prerequisite: Node.js 22 or a compatible current Node.js runtime.

1. Install dependencies:
   `npm ci`
2. Copy the required environment values into your local environment. Use `.env.example` as the contract; do not commit real credentials.
3. Start the local application:
   `npm run dev`
4. Run repository validation before proposing changes:
   `npm run lint`
5. Build the production bundle locally when needed:
   `npm run build`

## Important environment boundaries

- Firebase browser configuration uses the documented `VITE_FIREBASE_*` values.
- Provider secrets, access tokens, bot tokens and private keys must remain server-side and must never be exposed through `VITE_*` variables or Vite `define` injection.
- `GEMINI_API_KEY` is **not required by the current KCFC Portal application**.
- Isolated staging requires both `VITE_KCFC_RUNTIME_ENV=staging` and `KCFC_RUNTIME_ENV=staging`, explicit staging Firebase configuration, explicit staging Web Push keys, connector flags OFF and the Core-status staging executor OFF by default.
- Run `npm run staging:preflight` before using an actual staging environment.

## Production safety

Do not merge or deploy the redevelopment branch to production, perform destructive data/auth changes, activate live external messaging connectors, mass-send messages, or execute production Core-status mutations without the applicable explicit approval.

See `docs/redevelopment/` and Draft PR #1 for the current readiness evidence and execution checkpoints.
