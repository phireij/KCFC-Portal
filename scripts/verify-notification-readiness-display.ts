import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the actual display computations with synthetic browser/profile state.
// No browser, server, provider, notification, or member mutation is involved.
const source = fs.readFileSync(process.env.NOTIFICATION_HEALTH_SOURCE || 'src/components/NotificationHealth.tsx', 'utf8');
function computation(name: string) {
  const marker = `  const ${name} = useMemo(() => {`;
  const start = source.indexOf(marker);
  const end = source.indexOf('\n  }, [', start);
  assert.ok(start >= 0 && end > start, `${name} computation must exist`);
  return source.slice(start + marker.length, end);
}
const setup = source.match(/  const deviceSetupReady = ([\s\S]*?);/);
assert.ok(setup, 'one shared setup readiness predicate is required');
const script = ts.transpileModule(`
  const deviceSetupReady = ${setup[1]};
  ({ health: (() => {${computation('health')}})(),
     step: (() => {${computation('onboardingStep')}})(), deviceSetupReady });
`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function evaluate(overrides = {}) {
  return vm.runInNewContext(script, {
    permission: 'granted', standalone: true, ios: false, endpointCount: 1,
    online: true, serviceWorkerHealth: 'ready', currentDeviceEndpointHealth: 'registered',
    subscriptionCount: 1, tokenCount: 0, ...overrides,
  });
}
let checks = 0;
for (const worker of ['checking', 'unsupported', 'missing', 'ready']) {
  for (const endpoint of ['registered', 'unregistered', 'no_subscription', 'unknown']) {
    for (const tokens of [0, 1]) {
      const result = evaluate({ serviceWorkerHealth: worker, currentDeviceEndpointHealth: endpoint,
        tokenCount: tokens, endpointCount: 1 + tokens });
      const expected = worker === 'ready' && endpoint !== 'unregistered'
        && !(endpoint === 'no_subscription' && tokens === 0);
      assert.equal(result.deviceSetupReady, expected);
      assert.equal(result.step, expected ? 3 : 2);
      if (!expected) assert.notEqual(result.health.tone, 'good');
      checks++;
    }
  }
}
assert.equal(evaluate({ endpointCount: 0, subscriptionCount: 0 }).deviceSetupReady, false);
assert.equal(evaluate({ permission: 'denied' }).deviceSetupReady, false);
assert.equal(evaluate({ permission: 'default' }).step, 2);
assert.equal(evaluate({ ios: true, standalone: false }).step, 1);
assert.notEqual(evaluate({ online: false }).health.tone, 'good');
assert.match(source, /label="Enable alerts"[^\n]*done=\{deviceSetupReady\}/);
assert.match(source, /label="PWA Push"[^\n]*status=\{deviceSetupReady \?/);
console.log(`${checks + 7} notification-readiness display checks passed.`);
