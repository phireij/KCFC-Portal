import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Inbox.tsx', 'utf8');

const required = [
  'const [searchParams, setSearchParams] = useSearchParams();',
  'const setMessageInUrl = (id?: string) => {',
  "next.delete('noteId');",
  "if (id) next.set('id', id);",
  "else next.delete('id');",
  'setMessageInUrl(item.id);',
  'const closeMessage = () => {',
  'setMessageInUrl();',
  'onClick={closeMessage}',
  'if (!id) {',
  'setSelected(null);',
  'setMobileDetail(false);',
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Inbox message-history contract missing: ${marker}`);
  }
}

if (source.includes('onClick={() => setMobileDetail(false)}')) {
  throw new Error('Inbox mobile Back must clear the URL-selected message, not only local detail state.');
}

console.log('Inbox message URL/history contract: PASS');
