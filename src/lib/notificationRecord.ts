import type {
  CommunicationChannel,
  CommunicationSourceType,
  NotificationUrgency,
} from '../types';

export type NotificationRecordInput = {
  userId: string;
  title: string;
  message: string;
  type: 'announcement' | 'duty' | 'system' | 'broadcast';
  link?: string;
  sourceId?: string;
  sourceType?: CommunicationSourceType;
  urgency?: NotificationUrgency;
  channels?: CommunicationChannel[];
  extra?: Record<string, unknown>;
};

/**
 * Creates the transport-neutral Firestore payload for a KCFC Inbox notification.
 * The caller provides `createdAt` because Firestore serverTimestamp() belongs at
 * the database boundary rather than inside this pure metadata helper.
 */
export function buildNotificationRecord(input: NotificationRecordInput) {
  return {
    userId: input.userId,
    title: input.title,
    message: input.message,
    type: input.type,
    status: 'unread' as const,
    ...(input.link ? { link: input.link } : {}),
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    ...(input.sourceType ? { sourceType: input.sourceType } : {}),
    urgency: input.urgency || 'normal',
    channels: Array.from(new Set<CommunicationChannel>(['inbox', ...(input.channels || [])])),
    ...(input.extra || {}),
  };
}
