import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Announcements.tsx', 'utf8');
const trustedRoute = fs.readFileSync('server/announcementCommunicationRoutes.ts', 'utf8');

const required = [
  "import { useSearchParams } from 'react-router-dom';",
  'const [searchParams, setSearchParams] = useSearchParams();',
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

for (const marker of [
  "link: `/announcements?id=${announcementId}`",
  "click_action: `/announcements?id=${announcementId}`",
  "clickAction: `/announcements?id=${announcementId}`",
  "url: `/announcements?id=${announcementId}`",
]) {
  if (!trustedRoute.includes(marker)) {
    throw new Error(`Trusted announcement route must retain focused Updates deep-link marker: ${marker}`);
  }
}

console.log('Updates announcement deep-link focus contract: PASS');
