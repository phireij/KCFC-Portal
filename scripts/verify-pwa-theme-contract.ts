import { readFileSync } from 'node:fs';

const css = readFileSync('src/index.css', 'utf8');
const html = readFileSync('index.html', 'utf8');
const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8'));

const match = css.match(/--kcfc-navy:\s*(#[0-9a-fA-F]{6})\s*;/);
if (!match) {
  throw new Error('Unable to resolve canonical --kcfc-navy color from src/index.css.');
}

const canonicalNavy = match[1].toLowerCase();
const manifestTheme = String(manifest.theme_color || '').toLowerCase();
if (manifestTheme !== canonicalNavy) {
  throw new Error(`PWA manifest theme_color ${manifestTheme || '(missing)'} must match canonical KCFC navy ${canonicalNavy}.`);
}

const htmlThemeMatch = html.match(/<meta\s+name=["']theme-color["']\s+content=["'](#[0-9a-fA-F]{6})["']\s*\/>/i);
if (!htmlThemeMatch) {
  throw new Error('index.html must define a six-digit theme-color meta tag.');
}
if (htmlThemeMatch[1].toLowerCase() !== canonicalNavy) {
  throw new Error(`HTML theme-color ${htmlThemeMatch[1]} must match canonical KCFC navy ${canonicalNavy}.`);
}

if (String(manifest.start_url || '') !== '/' || String(manifest.scope || '') !== '/') {
  throw new Error('PWA manifest start_url and scope must remain root-relative (/) for same-origin portal + notification behavior.');
}
if (String(manifest.display || '') !== 'standalone') {
  throw new Error('PWA manifest display must remain standalone.');
}

console.log(`PWA theme contract verified (${canonicalNavy}, root scope, standalone display).`);
