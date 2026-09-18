import fs from 'node:fs';

const bannerSource = fs.readFileSync('src/components/layout/StagingEnvironmentBanner.tsx', 'utf8');
const navbarSource = fs.readFileSync('src/components/layout/Navbar.tsx', 'utf8');

const bannerMarkers = [
  "import.meta.env.VITE_KCFC_RUNTIME_ENV === 'staging'",
  'if (!isStaging) return null;',
  'Staging • Test environment',
  'aria-label="Staging test environment"',
];

for (const marker of bannerMarkers) {
  if (!bannerSource.includes(marker)) {
    throw new Error(`Missing staging environment badge marker: ${marker}`);
  }
}

if (!navbarSource.includes("import StagingEnvironmentBanner from './StagingEnvironmentBanner';")) {
  throw new Error('Navbar must import the staging environment badge');
}

if (!navbarSource.includes('<StagingEnvironmentBanner />')) {
  throw new Error('Navbar must render the staging environment badge');
}

if (bannerSource.includes("VITE_KCFC_RUNTIME_ENV !== 'production'")) {
  throw new Error('Staging badge must fail closed and render only for explicit staging runtime');
}

console.log('Staging environment badge boundary: PASS');
