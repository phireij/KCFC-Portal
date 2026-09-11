import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('server.ts', 'utf8');
const routeMarker = 'app.post("/api/users/send-test-push"';
const routeStart = source.indexOf(routeMarker);
assert.notEqual(routeStart, -1, 'Self-test push route must exist.');

const remainder = source.slice(routeStart + routeMarker.length);
const nextRouteOffset = remainder.search(/\n\s*app\.(?:get|post|put|patch|delete)\(/);
const route = source.slice(routeStart, nextRouteOffset === -1 ? source.length : routeStart + routeMarker.length + nextRouteOffset);

assert.match(route, /authAdmin\.verifyIdToken\(token\)/, 'Self-test push must verify the caller Firebase ID token.');
assert.match(route, /const callerUid = decodedToken\.uid/, 'Self-test push must derive the recipient identity from the verified token.');
assert.match(route, /fetchUserDocWithFallback\(callerUid, token\)/, 'Self-test push must load only the verified caller profile.');
assert.match(route, /userId:\s*callerUid/, 'Any Firestore fallback notification must remain bound to the verified caller UID.');
assert.doesNotMatch(route, /fetchAllUsersWithFallback\(/, 'Self-test push must never enumerate the member directory.');
assert.doesNotMatch(route, /req\.body\s*\.(?:target|targetUid|userId|uid|recipient)/, 'Self-test push must not accept a caller-selected recipient.');
assert.doesNotMatch(route, /const\s*\{[^}]*\b(?:target|targetUid|targetToken|userId|uid|recipient)\b[^}]*\}\s*=\s*req\.body/, 'Self-test push must not destructure a caller-selected recipient or push token.');
assert.doesNotMatch(route, /\btargetToken\b/, 'Self-test push must never accept a caller-supplied push token.');
assert.match(route, /const savedTokens = callerProfile\.fcmTokens \|\| \[\]/, 'Self-test FCM tokens must come from the authenticated caller profile.');

console.log('Self-test push recipient-boundary verification passed.');
