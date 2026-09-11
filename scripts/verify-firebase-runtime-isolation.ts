import { readFileSync } from 'node:fs';

const firebaseSource = readFileSync('src/lib/firebase.ts', 'utf8');
const envExample = readFileSync('.env.example', 'utf8');

const requiredSourceFragments = [
  "const runtimeEnvironment = String(metaEnv.VITE_KCFC_RUNTIME_ENV || 'production')",
  "if (runtimeEnvironment === 'staging')",
  "if (!hasEnvConfig)",
  'Refusing to fall back to the committed Firebase project.',
  "if (String(envConfig.projectId || '').trim() === committedProjectId)",
  'staging Firebase projectId must differ from the committed production/default projectId.',
  'const firebaseConfig = hasEnvConfig',
  '? { ...envConfig }',
  ': (hasFileConfig ? { ...firebaseConfigFromFile } : {})',
];

for (const fragment of requiredSourceFragments) {
  if (!firebaseSource.includes(fragment)) {
    throw new Error(`Firebase runtime isolation contract missing source fragment: ${fragment}`);
  }
}

if (firebaseSource.includes('const firebaseConfig = hasFileConfig ?')) {
  throw new Error('Committed Firebase file must not take precedence over explicit runtime environment configuration.');
}

const requiredEnvFragments = [
  'VITE_KCFC_RUNTIME_ENV=production',
  'VITE_FIREBASE_API_KEY=',
  'VITE_FIREBASE_PROJECT_ID=',
  'Staging must use an isolated Firebase project',
];

for (const fragment of requiredEnvFragments) {
  if (!envExample.includes(fragment)) {
    throw new Error(`.env.example missing Firebase runtime isolation guidance: ${fragment}`);
  }
}

console.log('Firebase runtime isolation contract verified.');
