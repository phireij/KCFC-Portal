export type SelfTestPushResult = { tone: 'ok' | 'error'; text: string };

/** Transport acknowledgement is not evidence of OS presentation on this device. */
export function describeSelfTestPushResult(httpOk: boolean, value: unknown): SelfTestPushResult {
  const result = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  if (['success', 'inboxFallback', 'transportAccepted', 'isSandboxSimulated'].some(
    key => result[key] !== undefined && typeof result[key] !== 'boolean',
  )) {
    return { tone: 'error', text: 'The test returned an invalid status. Smartphone notification delivery is not confirmed.' };
  }
  if (result.inboxFallback === true) {
    return { tone: 'error', text: 'Push delivery was not confirmed. An Inbox-only fallback was saved; this is not a successful smartphone notification test.' };
  }
  if (result.isSandboxSimulated === true) {
    return { tone: 'error', text: 'This was a simulated test. Real smartphone notification delivery is not confirmed.' };
  }
  if (result.transportAccepted === false) {
    return { tone: 'error', text: 'The push service did not confirm delivery. Do not record this as a successful smartphone notification test.' };
  }
  if (httpOk && result.success === true && result.transportAccepted !== false) {
    return { tone: 'ok', text: 'The push service accepted the test. Confirm the notification actually appears on this device and opens the KCFC Inbox before recording a pass.' };
  }
  return {
    tone: 'error',
    text: typeof result.error === 'string' ? result.error
      : typeof result.message === 'string' ? result.message
      : 'The test notification could not be dispatched.',
  };
}
