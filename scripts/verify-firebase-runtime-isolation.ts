import { readFileSync } from 'node:fs';

const clientSource = readFileSync('src/lib/firebase.ts', 'utf8');
const serverSource = readFileSync('server.ts', 'utf8');
const envExample = readFileSync('.env.example', 'utf8');

const requiredClientFragments = [
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

for (const fragment of requiredClientFragments) {
  if (!clientSource.includes(fragment)) {
    throw new Error(`Client Firebase runtime isolation contract missing source fragment: ${fragment}`);
  }
}

if (clientSource.includes('const firebaseConfig = hasFileConfig ?')) {
  throw new Error('Client committed Firebase file must not take precedence over explicit runtime environment configuration.');
}

const requiredServerFragments = [
  'const runtimeEnvironment = String(process.env.KCFC_RUNTIME_ENV || "production")',
  'const serverEnvConfig = hasServerEnvConfig ? {',
  'if (runtimeEnvironment === "staging")',
  'KCFC_RUNTIME_ENV=staging requires explicit FIREBASE_* staging configuration.',
  'server staging Firebase projectId must differ from the committed production/default projectId.',
  'const firebaseConfig: any = serverEnvConfig',
  '? { ...serverEnvConfig }',
  ': (hasFileConfig ? { ...firebaseConfigFromFile } : {})',
];

for (const fragment of requiredServerFragments) {
  if (!serverSource.includes(fragment)) {
    throw new Error(`Server Firebase runtime isolation contract missing source fragment: ${fragment}`);
  }
}

if (serverSource.includes('const firebaseConfig = hasFileConfig ?')) {
  throw new Error('Server committed Firebase file must not take precedence over explicit runtime environment configuration.');
}

const requiredEnvFragments = [
  'VITE_KCFC_RUNTIME_ENV=production',
  'KCFC_RUNTIME_ENV=production',
  'VITE_FIREBASE_API_KEY=',
  'VITE_FIREBASE_PROJECT_ID=',
  'FIREBASE_API_KEY=',
  'FIREBASE_PROJECT_ID=',
  'Staging must use an isolated Firebase project',
];

for (const fragment of requiredEnvFragments) {
  if (!envExample.includes(fragment)) {
    throw new Error(`.env.example missing Firebase runtime isolation guidance: ${fragment}`);
  }
}

console.log('Client + server Firebase runtime isolation contract verified.');
