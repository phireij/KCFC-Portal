import fs from 'node:fs';

const pollsSource = fs.readFileSync('src/pages/Polls.tsx', 'utf8');
const communicationSource = fs.readFileSync('src/lib/liturgicalCommunication.ts', 'utf8');

const required = [
  "const focusedPollId = searchParams.get('id');",
  "const focusPollTarget = (prefix: 'availability' | 'leader-availability', targetId: string) =>",
  "target.scrollIntoView({ behavior: 'smooth', block: 'center' });",
  "target.focus({ preventScroll: true });",
  "focusPollTarget('leader-availability', targetId);",
  "focusPollTarget('availability', targetId);",
  "focused={focusedPollId === poll.id}",
  "id={`availability-${poll.id}`}",
  "id={`leader-availability-${poll.id}`}",
  "aria-current={focused ? 'true' : undefined}",
];

for (const marker of required) {
  if (!pollsSource.includes(marker)) {
    throw new Error(`Missing availability deep-link focus marker: ${marker}`);
  }
}

if (!communicationSource.includes("link: `/polls?id=${input.pollId}`")) {
  throw new Error('Availability notification link contract is missing');
}

if (!communicationSource.includes("link: `/polls?id=${input.pollId}&leader=1`")) {
  throw new Error('Leader availability notification link contract is missing');
}

console.log('Availability notification deep-link focus: PASS');
