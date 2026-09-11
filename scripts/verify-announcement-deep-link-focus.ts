import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Announcements.tsx', 'utf8');

const required = [
  "import { useSearchParams } from 'react-router-dom';",
  'const [searchParams] = useSearchParams();',
  "const focusedAnnouncementId = searchParams.get('id');",
  "document.getElementById(`announcement-${focusedAnnouncementId}`)",
  "target.scrollIntoView({ behavior: 'smooth', block: 'center' });",
  "target.focus({ preventScroll: true });",
  'focused={focusedAnnouncementId === announcement.id}',
  "id={announcement.id ? `announcement-${announcement.id}` : undefined}",
  "focused && 'bg-blue-50/60 ring-2 ring-inset ring-blue-400",
  'tabIndex={focused ? -1 : undefined}',
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Announcement deep-link focus contract missing: ${marker}`);
  }
}

if (!source.includes("link: `/announcements?id=${announcementId}`")) {
  throw new Error('Announcement notification link must remain compatible with the focused Updates deep link.');
}

console.log('Updates announcement deep-link focus contract: PASS');
