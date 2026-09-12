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

const inboxQuery = "query(collection(db, 'notifications'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'))";
if (!source.includes(inboxQuery)) {
  throw new Error('Inbox notification query contract changed; review Firestore composite index requirements');
}

const indexManifest = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8')) as {
  indexes?: Array<{
    collectionGroup?: string;
    queryScope?: string;
    fields?: Array<{ fieldPath?: string; order?: string }>;
  }>;
};
const hasInboxIndex = indexManifest.indexes?.some((index) =>
  index.collectionGroup === 'notifications'
  && index.queryScope === 'COLLECTION'
  && index.fields?.length === 2
  && index.fields[0]?.fieldPath === 'userId'
  && index.fields[0]?.order === 'ASCENDING'
  && index.fields[1]?.fieldPath === 'createdAt'
  && index.fields[1]?.order === 'DESCENDING'
);
if (!hasInboxIndex) {
  throw new Error('Missing Firestore composite index for notifications(userId ASC, createdAt DESC)');
}

console.log('Inbox filter URL/history and Firestore index contract: PASS');
