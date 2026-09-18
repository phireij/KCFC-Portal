import type { Express, Request } from 'express';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { buildCommunicationRoutingPlan } from '../src/lib/communicationRouting';
import { isProfileEligibleForAudience, type CommunicationAudience } from '../src/lib/communicationAudience';
import { buildNotificationRecord } from '../src/lib/notificationRecord';

const ANNOUNCEMENT_CREATOR_ROLES = new Set([
  'admin',
  'president',
  'vice_president',
  'spiritual_director',
  'secretary',
  'pro',
]);

const VALID_AUDIENCES = new Set<CommunicationAudience>(['public', 'parishioners', 'kcfc_members', 'leadership']);

type AnnouncementCommunicationDependencies = {
  auth: Auth;
  db: Firestore;
  staging: boolean;
  getMessaging: () => {
    sendEachForMulticast: (message: any) => Promise<{ successCount: number; failureCount: number }>;
  };
  sendWebPush: (
    subscription: any,
    title: string,
    body: string,
    clickUrl: string,
  ) => Promise<{ success: boolean; expired?: boolean; error?: string }>;
};

function bearerToken(req: Request) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

function connectedProvidersFor(apps: unknown) {
  if (!Array.isArray(apps)) return [] as Array<'line' | 'telegram' | 'whatsapp' | 'viber'>;
  const allowed = new Set(['line', 'telegram', 'whatsapp', 'viber']);
  return apps.flatMap((app: any) => {
    const provider = String(app?.provider || '');
    return app?.status === 'connected' && allowed.has(provider)
      ? [provider as 'line' | 'telegram' | 'whatsapp' | 'viber']
      : [];
  });
}

function deliverableFcmTokens(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.flatMap((token) => {
    if (typeof token !== 'string') return [];
    const trimmed = token.trim();
    if (!trimmed || trimmed.startsWith('simulated') || trimmed.startsWith('webpush-registered-token-for-user:')) return [];
    return [trimmed];
  });
}

async function authorizeAnnouncementCreator(auth: Auth, db: Firestore, token: string) {
  const decoded = await auth.verifyIdToken(token);
  const email = String(decoded.email || '').trim().toLowerCase();
  if (email === 'kcfc.jp@gmail.com') return { uid: decoded.uid, allowed: true };

  const caller = await db.collection('users').doc(decoded.uid).get();
  if (!caller.exists) return { uid: decoded.uid, allowed: false };
  const data = caller.data() || {};
  const roles = Array.isArray(data.roles) ? data.roles.filter((role): role is string => typeof role === 'string') : [];
  return {
    uid: decoded.uid,
    allowed: data.isVerified === true
      && data.isDisabled !== true
      && roles.some((role) => ANNOUNCEMENT_CREATOR_ROLES.has(role)),
  };
}

export function registerAnnouncementCommunicationRoutes(
  app: Express,
  { auth, db, staging, getMessaging, sendWebPush }: AnnouncementCommunicationDependencies,
) {
  app.post('/api/announcements/publish-notifications', async (req, res) => {
    const token = bearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const announcementId = typeof req.body?.announcementId === 'string' ? req.body.announcementId.trim() : '';
    if (!announcementId || announcementId.length > 160 || announcementId.includes('/')) {
      res.status(400).json({ error: 'Invalid announcement ID' });
      return;
    }

    try {
      const caller = await authorizeAnnouncementCreator(auth, db, token);
      if (!caller.allowed) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const announcementRef = db.collection('announcements').doc(announcementId);
      const announcementSnap = await announcementRef.get();
      if (!announcementSnap.exists) {
        res.status(404).json({ error: 'Announcement not found' });
        return;
      }

      const announcement = announcementSnap.data() || {};
      if (announcement.status !== 'published') {
        res.status(409).json({ error: 'Announcement must be published before notifications are dispatched' });
        return;
      }
      if (announcement.notificationDispatchCompletedAt) {
        res.json({
          success: true,
          alreadyDispatched: true,
          recipientCount: Number(announcement.notificationRecipientCount || 0),
          stagingSuppressed: staging,
        });
        return;
      }

      const audience = String(announcement.audience || 'kcfc_members') as CommunicationAudience;
      if (!VALID_AUDIENCES.has(audience)) {
        res.status(400).json({ error: 'Announcement has an invalid audience' });
        return;
      }

      const title = String(announcement.title || '').trim();
      const body = String(announcement.summary || announcement.content || '').trim();
      if (!title || !body) {
        res.status(400).json({ error: 'Announcement is missing title or message content' });
        return;
      }

      const channels = Array.isArray(announcement.channels)
        ? announcement.channels.filter((value): value is string => typeof value === 'string')
        : [];
      const allowPwa = channels.includes('push');
      const users = await db.collection('users').get();
      const recipients: Array<{
        uid: string;
        routing: ReturnType<typeof buildCommunicationRoutingPlan>;
        fcmTokens: string[];
        webPushSubscriptions: any[];
      }> = [];

      for (const userDoc of users.docs) {
        const data = userDoc.data() || {};
        if (!isProfileEligibleForAudience(data, audience)) continue;
        const routing = buildCommunicationRoutingPlan({
          kind: 'announcement',
          preferences: data.preferences,
          connectedProviders: connectedProvidersFor(data.connectedCommunicationApps),
          allowPwa,
          allowEmail: true,
          allowExternalConnectors: false,
        });
        recipients.push({
          uid: userDoc.id,
          routing,
          fcmTokens: routing.channels.includes('pwa') ? deliverableFcmTokens(data.fcmTokens) : [],
          webPushSubscriptions: routing.channels.includes('pwa') && Array.isArray(data.webPushSubscriptions)
            ? data.webPushSubscriptions
            : [],
        });
      }

      // Keep Portal Inbox creation deterministic so retries cannot create duplicate records.
      for (let offset = 0; offset < recipients.length; offset += 400) {
        const batch = db.batch();
        for (const recipient of recipients.slice(offset, offset + 400)) {
          const notificationRef = db.collection('notifications').doc(`announcement_${announcementId}_${recipient.uid}`);
          batch.set(notificationRef, {
            ...buildNotificationRecord({
              userId: recipient.uid,
              title: 'KCFC Update',
              message: title,
              type: 'announcement',
              link: `/announcements?id=${announcementId}`,
              sourceId: announcementId,
              sourceType: 'announcement',
              urgency: recipient.routing.urgency,
              channels: recipient.routing.channels,
              extra: {
                audience,
                routingRationale: recipient.routing.rationale,
              },
            }),
            createdAt: FieldValue.serverTimestamp(),
          }, { merge: false });
        }
        await batch.commit();
      }

      let fcmSuccessCount = 0;
      let fcmFailureCount = 0;
      let webPushSuccessCount = 0;
      let webPushFailureCount = 0;

      if (!staging && allowPwa) {
        const allTokens = Array.from(new Set(recipients.flatMap((recipient) => recipient.fcmTokens)));
        if (allTokens.length > 0) {
          const messaging = getMessaging();
          for (let offset = 0; offset < allTokens.length; offset += 500) {
            const response = await messaging.sendEachForMulticast({
              tokens: allTokens.slice(offset, offset + 500),
              notification: {
                title: `KCFC Update: ${title}`,
                body: body.length > 150 ? `${body.slice(0, 147)}...` : body,
              },
              data: {
                click_action: `/announcements?id=${announcementId}`,
                clickAction: `/announcements?id=${announcementId}`,
                url: `/announcements?id=${announcementId}`,
              },
            });
            fcmSuccessCount += response.successCount;
            fcmFailureCount += response.failureCount;
          }
        }

        for (const recipient of recipients) {
          for (const subscription of recipient.webPushSubscriptions) {
            const result = await sendWebPush(
              subscription,
              `KCFC Update: ${title}`,
              body,
              `/announcements?id=${announcementId}`,
            );
            if (result.success) webPushSuccessCount += 1;
            else webPushFailureCount += 1;
          }
        }
      }

      await announcementRef.set({
        notificationDispatchCompletedAt: FieldValue.serverTimestamp(),
        notificationRecipientCount: recipients.length,
        notificationTransportSummary: {
          stagingSuppressed: staging,
          fcmSuccessCount,
          fcmFailureCount,
          webPushSuccessCount,
          webPushFailureCount,
        },
      }, { merge: true });

      res.json({
        success: true,
        alreadyDispatched: false,
        recipientCount: recipients.length,
        stagingSuppressed: staging,
        fcmSuccessCount,
        fcmFailureCount,
        webPushSuccessCount,
        webPushFailureCount,
      });
    } catch (error) {
      console.error('[ANNOUNCEMENT NOTIFICATION ERROR]', error);
      res.status(500).json({ error: 'Announcement notification dispatch failed' });
    }
  });
}
