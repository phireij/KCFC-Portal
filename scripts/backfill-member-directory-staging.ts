import fs from 'node:fs';
import path from 'node:path';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { toMemberDirectoryProfile } from '../src/lib/memberPublicProjection';

const runtime = String(process.env.KCFC_RUNTIME_ENV || '').trim().toLowerCase();
if (runtime !== 'staging') {
  throw new Error('Member-directory backfill is staging-only. Set KCFC_RUNTIME_ENV=staging.');
}

const targetProjectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
if (!targetProjectId) {
  throw new Error('Member-directory staging backfill requires FIREBASE_PROJECT_ID.');
}

const committedConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const committedConfig = JSON.parse(fs.readFileSync(committedConfigPath, 'utf8')) as { projectId?: string };
const committedProjectId = String(committedConfig.projectId || '').trim();
if (!committedProjectId) {
  throw new Error('Committed Firebase project ID could not be determined.');
}
if (targetProjectId === committedProjectId) {
  throw new Error('Refusing member-directory backfill against the committed production/default Firebase project.');
}

const databaseId = String(process.env.FIREBASE_DATABASE_ID || '(default)').trim() || '(default)';
const apply = String(process.env.KCFC_MEMBER_DIRECTORY_BACKFILL_APPLY || '').trim().toLowerCase() === 'true';
const app = getApps().find((candidate) => candidate.name === 'member-directory-backfill') || initializeApp({
  projectId: targetProjectId,
}, 'member-directory-backfill');
const db = databaseId === '(default)' ? getFirestore(app) : getFirestore(app, databaseId);

const usersSnapshot = await db.collection('users').get();
const projections = usersSnapshot.docs
  .map((document) => toMemberDirectoryProfile(document.id, document.data()))
  .filter((member): member is NonNullable<typeof member> => Boolean(member));

console.log(JSON.stringify({
  mode: apply ? 'apply' : 'plan',
  runtime,
  projectId: targetProjectId,
  databaseId,
  sourceUserDocuments: usersSnapshot.size,
  publicProjectionDocuments: projections.length,
  destructiveDeletes: 0,
}, null, 2));

if (!apply) {
  console.log('Plan only. No Firestore writes performed. Set KCFC_MEMBER_DIRECTORY_BACKFILL_APPLY=true to write to isolated staging.');
  process.exit(0);
}

for (let offset = 0; offset < projections.length; offset += 400) {
  const batch = db.batch();
  projections.slice(offset, offset + 400).forEach((member) => {
    batch.set(db.collection('member_directory').doc(member.uid), member, { merge: false });
  });
  await batch.commit();
}

console.log(`Member-directory staging backfill complete: ${projections.length} public-safe document(s) written; no deletes performed.`);
