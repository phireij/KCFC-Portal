import assert from 'node:assert/strict';
import { diffLiturgicalAssignments } from '../src/lib/liturgicalAssignmentDiff';

const previous = {
  '2026-10-04': {
    'member-a': 'Commentator',
    'member-b': 'Lector 1',
    'member-c': 'Usher 1',
  },
  '2026-10-11': {
    'member-a': 'Lector 2',
    'member-d': 'Altar Server 1',
  },
};

const current = {
  '2026-10-04': {
    'member-a': 'Commentator',
    'member-b': 'Lector 2',
    'member-new': 'Usher 1',
  },
  '2026-10-11': {
    'member-a': 'Lector 2',
    'member-d': 'Altar Server 1',
  },
};

const diff = diffLiturgicalAssignments(previous, current);
assert.deepEqual(diff.addedUserIds, ['member-new']);
assert.deepEqual(diff.removedUserIds, ['member-c']);
assert.deepEqual(diff.changedUserIds, ['member-b']);
assert.deepEqual(diff.affectedUserIds, ['member-b', 'member-c', 'member-new']);

const reordered = diffLiturgicalAssignments(
  { date: { b: 'Usher 1', a: 'Lector 1' } },
  { date: { a: 'Lector 1', b: 'Usher 1' } },
);
assert.deepEqual(reordered.affectedUserIds, []);

const empty = diffLiturgicalAssignments({}, {});
assert.deepEqual(empty.affectedUserIds, []);

console.log('Liturgical assignment diff verification passed.');
