from pathlib import Path

path = Path('server.ts')
source = path.read_text()

anchor = '''function isDeliverableFcmToken(token: unknown): token is string {
  if (typeof token !== "string") return false;
  const trimmed = token.trim();
  if (!trimmed) return false;
  return !(
    trimmed.startsWith("simulated") ||
    trimmed.startsWith("webpush-registered-token-for-user:")
  );
}
'''

helper = anchor + '''
const MAX_WEB_PUSH_SUBSCRIPTIONS_PER_USER = 8;
const MAX_WEB_PUSH_ENDPOINT_LENGTH = 2048;
const MAX_WEB_PUSH_KEY_LENGTH = 512;

function normalizeWebPushSubscription(input: any) {
  if (!input || typeof input !== "object") return null;

  const endpoint = typeof input.endpoint === "string" ? input.endpoint.trim() : "";
  if (!endpoint || endpoint.length > MAX_WEB_PUSH_ENDPOINT_LENGTH) return null;

  try {
    const endpointUrl = new URL(endpoint);
    if (endpointUrl.protocol !== "https:") return null;
  } catch {
    return null;
  }

  const keys = input.keys;
  const p256dh = typeof keys?.p256dh === "string" ? keys.p256dh.trim() : "";
  const auth = typeof keys?.auth === "string" ? keys.auth.trim() : "";
  if (!p256dh || !auth || p256dh.length > MAX_WEB_PUSH_KEY_LENGTH || auth.length > MAX_WEB_PUSH_KEY_LENGTH) {
    return null;
  }

  let expirationTime: number | null = null;
  if (input.expirationTime !== null && input.expirationTime !== undefined) {
    const candidate = Number(input.expirationTime);
    if (!Number.isFinite(candidate) || candidate < 0) return null;
    expirationTime = candidate;
  }

  return {
    endpoint,
    expirationTime,
    keys: { p256dh, auth },
  };
}
'''

if anchor not in source:
    raise SystemExit('isDeliverableFcmToken anchor not found')
source = source.replace(anchor, helper, 1)

old = '''    const token = authHeader.split("Bearer ")[1];
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint) {
      res.status(400).json({ error: "Missing required subscription data" });
      return;
    }

    try {
'''
new = '''    const token = authHeader.split("Bearer ")[1];
    const { subscription } = req.body;
    const normalizedSubscription = normalizeWebPushSubscription(subscription);

    if (!normalizedSubscription) {
      res.status(400).json({ error: "Invalid Web Push subscription data" });
      return;
    }

    try {
'''
if old not in source:
    raise SystemExit('registration validation block not found')
source = source.replace(old, new, 1)

old2 = '''      let webPushSubscriptions: any[] = [];
      if (userDoc.exists) {
        webPushSubscriptions = userDoc.data()?.webPushSubscriptions || [];
      }

      // Filter out existing subscription with same endpoint to avoid duplicates
      webPushSubscriptions = webPushSubscriptions.filter(
        (sub: any) => sub.endpoint !== subscription.endpoint
      );

      // Add new subscription
      webPushSubscriptions.push({
        ...subscription,
        registeredAt: new Date().toISOString()
      });
'''
new2 = '''      let webPushSubscriptions: any[] = [];
      if (userDoc.exists) {
        const existingSubscriptions = userDoc.data()?.webPushSubscriptions;
        webPushSubscriptions = Array.isArray(existingSubscriptions) ? existingSubscriptions : [];
      }

      // Replace the same endpoint instead of accumulating duplicates, and keep a bounded
      // set of the most recent other devices so stale registrations cannot grow forever.
      webPushSubscriptions = webPushSubscriptions
        .filter((sub: any) => sub && typeof sub.endpoint === "string" && sub.endpoint !== normalizedSubscription.endpoint)
        .slice(-(MAX_WEB_PUSH_SUBSCRIPTIONS_PER_USER - 1));

      webPushSubscriptions.push({
        ...normalizedSubscription,
        registeredAt: new Date().toISOString()
      });
'''
if old2 not in source:
    raise SystemExit('registration storage block not found')
source = source.replace(old2, new2, 1)

old3 = "...(!result.success && 'error' in result && result.error ? { detail: result.error } : {}),"
new3 = "...(!result.success && 'error' in result ? { detail: result.error } : {}),"
if old3 not in source:
    raise SystemExit('Web Push result narrowing block not found')
source = source.replace(old3, new3, 1)

path.write_text(source)
