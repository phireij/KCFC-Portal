import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Inbox.tsx', 'utf8');
const required = [
  "const tabParam = searchParams.get('tab');",
  "tabs.includes(tabParam as Tab) ? (tabParam as Tab) : 'all'",
  "const setInboxTab = (nextTab: Tab) =>",
  "if (nextTab === 'all') next.delete('tab');",
  "else next.set('tab', nextTab);",
  "onClick={() => setInboxTab(item)}",
  "const next = new URLSearchParams(current);",
];
for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Missing Inbox URL-history marker: ${marker}`);
}
if (source.includes("const [tab, setTab] = useState<Tab>('all')")) {
  throw new Error('Inbox filter must not regress to local-only tab state');
}
if (!source.includes("if (id) next.set('id', id);")) {
  throw new Error('Inbox message id deep-link preservation marker missing');
}
console.log('Inbox filter URL/history navigation: PASS');
