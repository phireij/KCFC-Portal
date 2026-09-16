import assert from 'node:assert/strict';
import { createDeviceQaSnapshot, formatDeviceQaSnapshot } from '../src/lib/deviceQaSnapshot';

const snapshot = createDeviceQaSnapshot({
  now: () => new Date('2026-09-11T03:00:00.000Z'),
  userAgent: 'KCFC-QA-UA',
  platform: 'TestOS',
  language: 'en-US',
  timezone: 'Asia/Tokyo',
  width: 390,
  height: 844,
  devicePixelRatio: 3,
  online: true,
  standalone: true,
  notificationPermission: 'granted',
  serviceWorkerSupported: true,
  pushManagerSupported: true,
});

assert.equal(snapshot.capturedAt, '2026-09-11T03:00:00.000Z');
assert.deepEqual(snapshot.viewport, { width: 390, height: 844, devicePixelRatio: 3 });
assert.equal(snapshot.standalone, true);
assert.equal(snapshot.notificationPermission, 'granted');
assert.equal(snapshot.serviceWorkerSupported, true);
assert.equal(snapshot.pushManagerSupported, true);

const formatted = formatDeviceQaSnapshot(snapshot);
assert.match(formatted, /PWA standalone: yes/);
assert.match(formatted, /Notification permission: granted/);
assert.match(formatted, /390x844 @ 3x/);

for (const forbidden of ['endpoint', 'token', 'email', 'uid']) {
  assert.doesNotMatch(formatted.toLowerCase(), new RegExp(forbidden));
}

const safeDefaults = createDeviceQaSnapshot({
  now: () => new Date('2026-09-11T03:00:00.000Z'),
  width: -100,
  height: -50,
});
assert.equal(safeDefaults.viewport.width, 0);
assert.equal(safeDefaults.viewport.height, 0);
assert.equal(safeDefaults.notificationPermission, 'unsupported');

console.log('Device QA snapshot verification passed.');
