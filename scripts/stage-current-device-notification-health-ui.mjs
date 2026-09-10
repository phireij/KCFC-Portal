import fs from 'node:fs';

const path = 'src/components/NotificationHealth.tsx';
let source = fs.readFileSync(path, 'utf8');

const importAnchor = "import { cn } from '../lib/utils';\n";
const helperImport = "import { currentDeviceHealthLabel, evaluateCurrentWebPushEndpoint, type CurrentDeviceEndpointHealth } from '../lib/currentDeviceNotificationHealth';\n";
if (!source.includes(helperImport)) {
  if (!source.includes(importAnchor)) throw new Error('Current-device health migration: import anchor missing.');
  source = source.replace(importAnchor, importAnchor + helperImport);
}

const stateAnchor = "  const [serviceWorkerHealth, setServiceWorkerHealth] = useState<ServiceWorkerHealth>('checking');\n";
const stateReplacement = stateAnchor + "  const [currentDeviceEndpointHealth, setCurrentDeviceEndpointHealth] = useState<CurrentDeviceEndpointHealth>('unknown');\n";
if (!source.includes('currentDeviceEndpointHealth')) {
  if (!source.includes(stateAnchor)) throw new Error('Current-device health migration: state anchor missing.');
  source = source.replace(stateAnchor, stateReplacement);
}

const functionAnchor = "  const refreshServiceWorkerHealth = async () => {";
const functionInsert = `  const refreshCurrentDeviceEndpointHealth = async () => {\n    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {\n      setCurrentDeviceEndpointHealth('unknown');\n      return;\n    }\n    try {\n      const registration = await navigator.serviceWorker.getRegistration();\n      const subscription = registration?.pushManager ? await registration.pushManager.getSubscription() : null;\n      setCurrentDeviceEndpointHealth(evaluateCurrentWebPushEndpoint({\n        currentEndpoint: subscription?.endpoint || null,\n        storedSubscriptions: profile?.webPushSubscriptions || [],\n        inspectionSupported: true,\n      }));\n    } catch (error) {\n      console.warn('Notification health: current-device endpoint inspection failed', error);\n      setCurrentDeviceEndpointHealth('unknown');\n    }\n  };\n\n`;
if (!source.includes('const refreshCurrentDeviceEndpointHealth = async')) {
  if (!source.includes(functionAnchor)) throw new Error('Current-device health migration: function anchor missing.');
  source = source.replace(functionAnchor, functionInsert + functionAnchor);
}

const effectAnchor = "    void refreshServiceWorkerHealth();\n";
if (!source.includes('void refreshCurrentDeviceEndpointHealth();')) {
  if (!source.includes(effectAnchor)) throw new Error('Current-device health migration: effect anchor missing.');
  source = source.replace(effectAnchor, effectAnchor + "    void refreshCurrentDeviceEndpointHealth();\n");
}

const healthAnchor = "    if (serviceWorkerHealth === 'missing') return { label: 'Push service worker needs repair', tone: 'warning' as const };\n    if (endpointCount === 0) return { label: 'Permission granted — device registration needs repair', tone: 'warning' as const };\n    return { label: 'Notification delivery is ready', tone: 'good' as const };";
const healthReplacement = "    if (serviceWorkerHealth === 'missing') return { label: 'Push service worker needs repair', tone: 'warning' as const };\n    if (currentDeviceEndpointHealth === 'unregistered') return { label: 'This device subscription needs registration repair', tone: 'warning' as const };\n    if (currentDeviceEndpointHealth === 'no_subscription' && subscriptionCount > 0 && tokenCount === 0) return { label: 'Other device registrations exist — this device needs setup', tone: 'warning' as const };\n    if (endpointCount === 0) return { label: 'Permission granted — device registration needs repair', tone: 'warning' as const };\n    return { label: currentDeviceEndpointHealth === 'registered' ? 'This device is ready for notifications' : 'Notification registration exists — send a test to confirm this device', tone: currentDeviceEndpointHealth === 'registered' ? 'good' as const : 'warning' as const };";
if (!source.includes(healthAnchor)) {
  if (!source.includes("currentDeviceEndpointHealth === 'unregistered'")) throw new Error('Current-device health migration: health anchor missing.');
} else {
  source = source.replace(healthAnchor, healthReplacement);
}

source = source.replace(
  "  }, [permission, standalone, ios, endpointCount, online, serviceWorkerHealth]);",
  "  }, [permission, standalone, ios, endpointCount, online, serviceWorkerHealth, currentDeviceEndpointHealth, subscriptionCount, tokenCount]);",
);

const detailAnchor = "Permission: {permission} • Registered endpoints: {endpointCount} • App mode: {standalone ? 'installed' : 'browser'}";
const detailReplacement = "Permission: {permission} • Registered endpoints: {endpointCount} • Current device: {currentDeviceHealthLabel(currentDeviceEndpointHealth)} • App mode: {standalone ? 'installed' : 'browser'}";
if (source.includes(detailAnchor)) source = source.replace(detailAnchor, detailReplacement);

const refreshAnchor = "      await refreshServiceWorkerHealth();";
if (!source.includes('await refreshCurrentDeviceEndpointHealth();')) {
  source = source.replaceAll(refreshAnchor, refreshAnchor + "\n      await refreshCurrentDeviceEndpointHealth();");
}

fs.writeFileSync(path, source);
console.log('Staged current-device notification health UI integration.');
