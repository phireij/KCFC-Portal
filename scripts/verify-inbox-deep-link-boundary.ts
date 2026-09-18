import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Inbox.tsx', 'utf8');

const required = [
  'const safeInboxDestination = (link: string) => {',
  "const target = new URL(link, window.location.origin);",
  "if (target.origin !== window.location.origin) return '/inbox';",
  "return `${target.pathname}${target.search}${target.hash}`;",
  "return '/inbox';",
  'navigate(safeInboxDestination(selected.link));',
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Inbox deep-link boundary missing: ${marker}`);
  }
}

if (source.includes('if (selected?.link) navigate(selected.link);')) {
  throw new Error('Inbox must not navigate stored notification links without same-origin validation.');
}

console.log('Inbox same-origin full-URL deep-link boundary: PASS');
