import assert from 'node:assert/strict';
import { currentDeviceHealthLabel, evaluateCurrentWebPushEndpoint, normalizePushEndpoint } from '../src/lib/currentDeviceNotificationHealth';

assert.equal(normalizePushEndpoint('  https://push.example/device  '), 'https://push.example/device');
assert.equal(normalizePushEndpoint(undefined), '');

assert.equal(evaluateCurrentWebPushEndpoint({
  currentEndpoint: 'https://push.example/device-a',
  storedSubscriptions: [
    { endpoint: 'https://push.example/device-b' },
    { endpoint: 'https://push.example/device-a' },
  ],
}), 'registered');

assert.equal(evaluateCurrentWebPushEndpoint({
  currentEndpoint: 'https://push.example/current',
  storedSubscriptions: [{ endpoint: 'https://push.example/other-device' }],
}), 'unregistered');

assert.equal(evaluateCurrentWebPushEndpoint({
  currentEndpoint: null,
  storedSubscriptions: [{ endpoint: 'https://push.example/other-device' }],
}), 'no_subscription');

assert.equal(evaluateCurrentWebPushEndpoint({
  currentEndpoint: 'https://push.example/current',
  storedSubscriptions: [],
  inspectionSupported: false,
}), 'unknown');

assert.match(currentDeviceHealthLabel('registered'), /registered/i);
assert.match(currentDeviceHealthLabel('unregistered'), /repair/i);

console.log('Current-device notification health verification passed.');
