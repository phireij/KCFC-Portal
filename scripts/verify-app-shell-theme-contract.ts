import { readFileSync } from 'node:fs';

const source = readFileSync('src/App.tsx', 'utf8');

const forbidden = [
  '#5A5A40',
  '#5a5a40',
  'background=5A5A40',
  'bg-[#f5f5f0]',
];

for (const token of forbidden) {
  if (source.includes(token)) {
    throw new Error(`App shell still contains retired olive/canvas token: ${token}`);
  }
}

const required = [
  '#123B66',
  'background=123B66',
  'bg-[#F7F9FC]',
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`App shell theme contract missing approved token: ${token}`);
  }
}

console.log('App shell theme palette contract: PASS');
