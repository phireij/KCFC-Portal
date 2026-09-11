from pathlib import Path
p = Path('server.ts')
s = p.read_text()
needle = 'const runtimeEnvironment = String(process.env.KCFC_RUNTIME_ENV || "production").trim().toLowerCase();\n'
replacement = '''const runtimeEnvironment = String(process.env.KCFC_RUNTIME_ENV || "production").trim().toLowerCase();\nconst runtimeAppUrl = String(process.env.APP_URL || "").trim();\nif (runtimeEnvironment === "staging") {\n  if (!runtimeAppUrl) {\n    throw new Error("KCFC staging safety guard: APP_URL is required for staging.");\n  }\n  let stagingAppUrl: URL;\n  try {\n    stagingAppUrl = new URL(runtimeAppUrl);\n  } catch {\n    throw new Error("KCFC staging safety guard: staging APP_URL must be a valid absolute HTTPS URL.");\n  }\n  if (stagingAppUrl.protocol !== "https:") {\n    throw new Error("KCFC staging safety guard: staging APP_URL must be a valid absolute HTTPS URL.");\n  }\n  const productionPortalHostnames = new Set(['portal.kcfcjp.com', 'www.portal.kcfcjp.com']);\n  if (productionPortalHostnames.has(stagingAppUrl.hostname.toLowerCase())) {\n    throw new Error("KCFC staging safety guard: staging APP_URL must not target the production KCFC Portal hostname.");\n  }\n}\n'''
if s.count(needle) != 1:
    raise SystemExit(f'Expected runtimeEnvironment marker once, found {s.count(needle)}')
p.write_text(s.replace(needle, replacement))
