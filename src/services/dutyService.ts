import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PollResponse, DutyAssignment } from '../types';

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

  // Calculate local user workloads
  const workloadMap: Record<string, number> = {};
  attendees.forEach(a => {
    workloadMap[a.userId] = history.filter(h => h.userId === a.userId).length;
  });

  const currentlyAssignedCount: Record<string, number> = {};
  attendees.forEach(a => {
    currentlyAssignedCount[a.userId] = 0;
  });

  // Flat list of remaining slots to assign
  const slotsToAssign: { template: ChoreDutyTemplate; slotIndex: number }[] = [];
  templates.forEach(t => {
    const required = t.requiredPersons || 0;
    for (let i = 0; i < required; i++) {
      slotsToAssign.push({ template: t, slotIndex: i });
    }
  });

  // Prioritize Restricted slots first (e.g. toilet)
  slotsToAssign.sort((a, b) => {
    const rA = a.template.restrictedToToiletOk ? 1 : 0;
    const rB = b.template.restrictedToToiletOk ? 1 : 0;
    return rB - rA;
  });

  const assignments: AutoChoreAssignment[] = [];

  for (const slot of slotsToAssign) {
    let potential = attendees.filter(a => {
      if (slot.template.group === 'kitchen') {
        return !!a.isKitchen;
      }
      if (slot.template.group === 'cleaning') {
        return !!a.isCleaning;
      }
      return true;
    });

    // Handle toilet restriction among the eligible committee members
    if (slot.template.restrictedToToiletOk) {
      const toiletPotentials = potential.filter(a => a.toiletOk);
      if (toiletPotentials.length > 0) {
        potential = toiletPotentials;
      }
    }

    // Safe fallback if no specific committee members are present in Yes responses
    if (potential.length === 0) {
      potential = [...attendees];
      if (slot.template.restrictedToToiletOk) {
        const fallbackToilet = potential.filter(a => a.toiletOk);
        if (fallbackToilet.length > 0) {
          potential = fallbackToilet;
        }
      }
    }

    // Balance by current assignments, and then past history, with robust tiesbreaker
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

/**
 * Main legacy automatic assigner keeping backward compatibility
 */
export async function autoAssignDuties(pollId: string, date: string) {
  const responsesQ = query(
    collection(db, `polls/${pollId}/responses`),
    where('attendance', '==', 'yes')
  );
  const responsesSnap = await getDocs(responsesQ);
  const attendees = responsesSnap.docs.map(d => d.data() as PollResponse);

  if (attendees.length < 1) return { success: false, message: "Not enough attendees" };

  // Shuffling attendees for random mock dispatching
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
    await addDoc(collection(db, 'duties'), {
      ...assignment,
      assignedAt: serverTimestamp()
    });

    try {
      await addDoc(collection(db, 'notifications'), {
        userId: assignment.userId,
        title: 'Auto-Assigned Duty',
        message: `You have been automatically assigned to ${assignment.type} duty on ${new Date(date).toLocaleDateString()}.`,
        type: 'system',
        status: 'unread',
        link: '/duties',
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to create auto-duty notification", err);
    }
  }

  return { success: true, assignments };
}
