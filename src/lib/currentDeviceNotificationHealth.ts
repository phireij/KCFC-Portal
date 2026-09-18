export type CurrentDeviceEndpointHealth = 'registered' | 'unregistered' | 'no_subscription' | 'unknown';

export function normalizePushEndpoint(endpoint: unknown): string {
  return typeof endpoint === 'string' ? endpoint.trim() : '';
}

/**
 * Compares the browser's currently active native Web Push subscription with the
 * subscriptions stored on the member profile.
 *
 * This deliberately evaluates the current device rather than treating endpoints
 * belonging to other phones/browsers as proof that this browser is healthy.
 */
export function evaluateCurrentWebPushEndpoint({
  currentEndpoint,
  storedSubscriptions,
  inspectionSupported = true,
}: {
  currentEndpoint?: string | null;
  storedSubscriptions?: Array<{ endpoint?: string } | null | undefined>;
  inspectionSupported?: boolean;
}): CurrentDeviceEndpointHealth {
  if (!inspectionSupported) return 'unknown';

  const current = normalizePushEndpoint(currentEndpoint);
  if (!current) return 'no_subscription';

  const stored = new Set(
    (storedSubscriptions || [])
      .map((item) => normalizePushEndpoint(item?.endpoint))
      .filter(Boolean),
  );

  return stored.has(current) ? 'registered' : 'unregistered';
}

export function currentDeviceHealthLabel(health: CurrentDeviceEndpointHealth) {
  if (health === 'registered') return 'This device is registered';
  if (health === 'unregistered') return 'This device subscription needs registration repair';
  if (health === 'no_subscription') return 'This device has no active Web Push subscription';
  return 'Current-device subscription could not be inspected';
}
