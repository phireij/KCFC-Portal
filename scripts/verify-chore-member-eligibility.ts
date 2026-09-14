import assert from 'node:assert/strict';
import { balanceChoreSlots, isEligibleForChoreAssignment } from '../src/services/dutyService';

const coreCleaner = { userId: 'core-cleaner', userDisplayName: 'Core Cleaner', isCoreMember: true, isCleaning: true, isKitchen: false, toiletOk: true };
const coreKitchen = { userId: 'core-kitchen', userDisplayName: 'Core Kitchen', isCoreMember: true, isCleaning: false, isKitchen: true, toiletOk: false };
const regularCleaner = { userId: 'regular-cleaner', userDisplayName: 'Regular Cleaner', isCoreMember: false, isCleaning: true, isKitchen: false, toiletOk: true };
const toilet = { name: 'Toilet', group: 'cleaning' as const, requiredPersons: 2, restrictedToToiletOk: true };

assert.equal(isEligibleForChoreAssignment(coreCleaner, toilet), true);
assert.equal(isEligibleForChoreAssignment(regularCleaner, toilet), false);
assert.equal(isEligibleForChoreAssignment(coreKitchen, toilet), false);
assert.deepEqual(balanceChoreSlots([coreCleaner, regularCleaner, coreKitchen], [], [toilet]).map((assignment) => assignment.userId), ['core-cleaner', 'core-cleaner']);
assert.deepEqual(balanceChoreSlots([regularCleaner, coreKitchen], [], [toilet]), []);

console.log('Chore member eligibility verification passed.');
