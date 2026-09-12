import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PollResponse, DutyAssignment, UserProfile } from '../types';
import { buildDutyAssignmentNotification } from '../lib/dutyCommunication';
import { materializeNotificationRecord } from '../lib/notificationPersistence';

export interface ChoreAttendee {
  userId: string;
  userDisplayName: string;
  toiletOk: boolean;
  isKitchen?: boolean;
  isCleaning?: boolean;
}

export interface ChoreDutyTemplate {
  id?: string;
  name: string;
  group: 'cleaning' | 'kitchen';
  requiredPersons: number;
  restrictedToToiletOk: boolean;
}

export interface AutoChoreAssignment {
  userId: string;
  userDisplayName: string;
  dutyName: string;
  group: 'cleaning' | 'kitchen';
}

/**
 * Resilient load-balancing algorithm for Chore Committee Assignments.
 */
export function balanceChoreSlots(
  attendees: ChoreAttendee[],
  history: DutyAssignment[],
  templates: ChoreDutyTemplate[]
): AutoChoreAssignment[] {
  if (attendees.length === 0) return [];

  const workloadMap: Record<string, number> = {};
  attendees.forEach(a => {
    workloadMap[a.userId] = history.filter(h => h.userId === a.userId).length;
  });

  const currentlyAssignedCount: Record<string, number> = {};
  attendees.forEach(a => {
    currentlyAssignedCount[a.userId] = 0;
  });

  const slotsToAssign: { template: ChoreDutyTemplate; slotIndex: number }[] = [];
  templates.forEach(t => {
    const required = t.requiredPersons || 0;
    for (let i = 0; i < required; i++) {
      slotsToAssign.push({ template: t, slotIndex: i });
    }
  });

  slotsToAssign.sort((a, b) => {
    const rA = a.template.restrictedToToiletOk ? 1 : 0;
    const rB = b.template.restrictedToToiletOk ? 1 : 0;
    return rB - rA;
  });

  const assignments: AutoChoreAssignment[] = [];

  for (const slot of slotsToAssign) {
    let potential = attendees.filter(a => {
      if (slot.template.group === 'kitchen') return !!a.isKitchen;
      if (slot.template.group === 'cleaning') return !!a.isCleaning;
      return true;
    });

    if (slot.template.restrictedToToiletOk) {
      const toiletPotentials = potential.filter(a => a.toiletOk);
      if (toiletPotentials.length > 0) potential = toiletPotentials;
    }

    if (potential.length === 0) {
      potential = [...attendees];
      if (slot.template.restrictedToToiletOk) {
        const fallbackToilet = potential.filter(a => a.toiletOk);
        if (fallbackToilet.length > 0) potential = fallbackToilet;
      }
    }

    potential.sort((a, b) => {
      const curA = currentlyAssignedCount[a.userId] || 0;
      const curB = currentlyAssignedCount[b.userId] || 0;
      if (curA !== curB) return curA - curB;

      const histA = workloadMap[a.userId] || 0;
      const histB = workloadMap[b.userId] || 0;
      if (histA !== histB) return histA - histB;

      return Math.random() - 0.5;
    });

    const chosen = potential[0];
    if (chosen) {
      currentlyAssignedCount[chosen.userId]++;
      assignments.push({
        userId: chosen.userId,
        userDisplayName: chosen.userDisplayName,
        dutyName: slot.template.name,
        group: slot.template.group
      });
    }
  }

  return assignments;
}

async function readCommunicationProfile(userId: string): Promise<UserProfile | undefined> {
  try {
    const snapshot = await getDoc(doc(db, 'users', userId));
    return snapshot.exists() ? ({ uid: snapshot.id, ...snapshot.data() } as UserProfile) : undefined;
  } catch (error) {
    console.warn('Duty communication: member preferences unavailable; falling back to durable Inbox only.', error);
    return undefined;
  }
}

/**
 * Main legacy automatic assigner keeping backward compatibility.
 *
 * The duty assignment behavior remains unchanged. Its durable Portal Inbox record now
 * uses the shared KCFC notification schema. PWA/email execution remains deliberately
 * disabled here because the legacy service never executed those transports; this avoids
 * claiming a delivery channel that was not actually attempted.
 */
export async function autoAssignDuties(pollId: string, date: string) {
  const responsesQ = query(
    collection(db, `polls/${pollId}/responses`),
    where('attendance', '==', 'yes')
  );
  const responsesSnap = await getDocs(responsesQ);
  const attendees = responsesSnap.docs.map(d => d.data() as PollResponse);

  if (attendees.length < 1) return { success: false, message: 'Not enough attendees' };

  const shuffled = [...attendees].sort(() => Math.random() - 0.5);
  const assignments: Omit<DutyAssignment, 'id'>[] = [
    {
      pollId,
      userId: shuffled[0].userId,
      userDisplayName: shuffled[0].userDisplayName,
      type: 'kitchen',
      date,
      assignedBy: 'System',
      assignedAt: new Date().toISOString()
    }
  ];

  if (shuffled.length > 1) {
    assignments.push({
      pollId,
      userId: shuffled[1].userId,
      userDisplayName: shuffled[1].userDisplayName,
      type: 'cleaning',
      date,
      assignedBy: 'System',
      assignedAt: new Date().toISOString()
    });
  }

  for (const assignment of assignments) {
    const dutyRef = await addDoc(collection(db, 'duties'), {
      ...assignment,
      assignedAt: serverTimestamp()
    });

    try {
      const member = await readCommunicationProfile(assignment.userId);
      const notificationPlan = buildDutyAssignmentNotification({
        userId: assignment.userId,
        dutyId: dutyRef.id,
        title: 'Auto-Assigned Duty',
        message: `You have been automatically assigned to ${assignment.type} duty on ${new Date(date).toLocaleDateString()}.`,
        link: '/duties?view=mine',
        preferences: member?.preferences,
        connectedCommunicationApps: member?.connectedCommunicationApps,
        allowPwa: false,
        allowEmail: false,
      });

      await addDoc(
        collection(db, 'notifications'),
        materializeNotificationRecord(notificationPlan.record, serverTimestamp()),
      );
    } catch (err) {
      console.error('Failed to create auto-duty notification', err);
    }
  }

  return { success: true, assignments };
}
