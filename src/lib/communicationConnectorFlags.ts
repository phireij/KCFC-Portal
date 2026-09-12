import type { CommunicationConnectorProvider } from '../types';

export type CommunicationConnector = CommunicationConnectorProvider;

const enabled = (value: unknown) => String(value || '').trim().toLowerCase() === 'true';

/**
 * Client-readable availability only. These flags must not contain provider secrets.
 * Server-side connector credentials remain outside the browser bundle.
 */
export const communicationConnectorFlags: Record<CommunicationConnector, boolean> = {
  line: enabled(import.meta.env.VITE_KCFC_LINE_CONNECTOR_ENABLED),
  telegram: enabled(import.meta.env.VITE_KCFC_TELEGRAM_CONNECTOR_ENABLED),
  whatsapp: enabled(import.meta.env.VITE_KCFC_WHATSAPP_CONNECTOR_ENABLED),
  viber: enabled(import.meta.env.VITE_KCFC_VIBER_CONNECTOR_ENABLED),
};

export function isCommunicationConnectorEnabled(provider: CommunicationConnector) {
  return communicationConnectorFlags[provider] === true;
}
