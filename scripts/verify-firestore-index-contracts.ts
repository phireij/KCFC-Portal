import fs from 'node:fs';

type IndexField = { fieldPath?: string; order?: string; arrayConfig?: string };
type FirestoreIndex = {
  collectionGroup?: string;
  queryScope?: string;
  fields?: IndexField[];
};
type IndexManifest = { indexes?: FirestoreIndex[] };

const manifest = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8')) as IndexManifest;
const indexes = manifest.indexes || [];

const hasOrderedIndex = (
  collectionGroup: string,
  expectedFields: Array<{ fieldPath: string; order: 'ASCENDING' | 'DESCENDING' }>,
) => indexes.some((index) =>
  index.collectionGroup === collectionGroup
  && index.queryScope === 'COLLECTION'
  && index.fields?.length === expectedFields.length
  && expectedFields.every((expected, position) =>
    index.fields?.[position]?.fieldPath === expected.fieldPath
    && index.fields?.[position]?.order === expected.order,
  )
);

const inboxSource = fs.readFileSync('src/pages/Inbox.tsx', 'utf8');
const inboxQueryMarkers = [
  "where('userId', '==', user.uid)",
  "orderBy('createdAt', 'desc')",
];
for (const marker of inboxQueryMarkers) {
  if (!inboxSource.includes(marker)) {
    throw new Error(`Inbox Firestore query contract changed; review indexes before accepting: ${marker}`);
  }
}
if (!hasOrderedIndex('notifications', [
  { fieldPath: 'userId', order: 'ASCENDING' },
  { fieldPath: 'createdAt', order: 'DESCENDING' },
])) {
  throw new Error('Missing notifications(userId ASC, createdAt DESC) composite index');
}

const legacyDutiesSource = fs.readFileSync('src/pages/LegacyDutiesImpl.tsx', 'utf8');
const legacyPollQueryMarkers = [
  "where('category', 'in', ['committee', 'core_member'])",
  "orderBy('createdAt', 'desc')",
];
for (const marker of legacyPollQueryMarkers) {
  if (!legacyDutiesSource.includes(marker)) {
    throw new Error(`Legacy Schedule poll query contract changed; review indexes before accepting: ${marker}`);
  }
}
if (!hasOrderedIndex('polls', [
  { fieldPath: 'category', order: 'ASCENDING' },
  { fieldPath: 'createdAt', order: 'DESCENDING' },
])) {
  throw new Error('Missing polls(category ASC, createdAt DESC) composite index');
}

console.log('Firestore composite index contracts: PASS');
