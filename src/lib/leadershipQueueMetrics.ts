import type { Poll, UserProfile } from '../types';

type ContactQueueRecord = {
  status?: 'unread' | 'read' | 'archived' | string;
};

type ExtendedPoll = Poll & {
  rosterPublished?: boolean;
  publicationMode?: 'explicit';
};

export type LeadershipQueueMetrics = {
  pendingMembers: number;
  unreadInquiries: number;
  activeAvailability: number;
  unpublishedRosters: number;
  attentionItems: number;
};

export function buildLeadershipQueueMetrics(input: {
  users: UserProfile[];
  messages: ContactQueueRecord[];
  polls: ExtendedPoll[];
}): LeadershipQueueMetrics {
  const pendingMembers = input.users.filter((member) => !member.isVerified && !member.isDisabled).length;
  const unreadInquiries = input.messages.filter((message) => (message.status || 'unread') === 'unread').length;
  const activeAvailability = input.polls.filter((poll) => poll.category === 'committee' && poll.status === 'active').length;
  const unpublishedRosters = input.polls.filter((poll) =>
    poll.category === 'committee' &&
    poll.status === 'closed' &&
    poll.publicationMode === 'explicit' &&
    poll.rosterPublished !== true,
  ).length;

  return {
    pendingMembers,
    unreadInquiries,
    activeAvailability,
    unpublishedRosters,
    attentionItems: pendingMembers + unreadInquiries + unpublishedRosters,
  };
}
