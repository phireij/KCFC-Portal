export type UserRole = 
  | 'spiritual_director' 
  | 'admin' 
  | 'president' 
  | 'vice_president'
  | 'secretary' 
  | 'treasurer' 
  | 'auditor'
  | 'pro' 
  | 'choir_a_leader'
  | 'choir_b_leader'
  | 'lector_commentator_leader'
  | 'usher_leader'
  | 'altar_server_leader'
  | 'kitchen_leader'
  | 'kitchen_sub_leader'
  | 'cleaning_leader'
  | 'cleaning_sub_leader'
  | 'member';
export type MinistryType = 
  | 'choir_a' 
  | 'choir_b' 
  | 'lector_commentator' 
  | 'usher' 
  | 'altar_server' 
  | 'kitchen' 
  | 'cleaning'
  | 'cleaning_toilet_ok'
  | 'cleaning_toilet_ng';
export type PollType = 'weekly' | 'quarterly';
export type PollCategory = 'standard' | 'core_member' | 'committee';
export type PollStatus = 'active' | 'closed' | 'draft';
export type AttendanceType = 'yes' | 'no' | 'maybe';
export type DutyType = 'kitchen' | 'cleaning' | 'ministry';

export interface Notification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: 'announcement' | 'duty' | 'system' | 'broadcast';
  status: 'unread' | 'read';
  link?: string;
  createdAt: any;
}

export interface NotificationPreferences {
  announcements: boolean;
  duties: boolean;
  broadcasts: boolean;
  darkMode?: boolean;
  fontSize?: 'small' | 'normal' | 'medium' | 'big';
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  roles: UserRole[];
  ministries: MinistryType[];
  isVerified: boolean;
  isCoreMember?: boolean;
  isDisabled?: boolean;
  isEmailVerified?: boolean;
  nickname?: string;
  birthdate?: string;
  homeAddress?: string;
  phoneNumber?: string;
  lcRoles?: string[];
  createdAt: string;
  updatedAt: string;
  preferences?: NotificationPreferences;
}

export interface MassOption {
  date: string;
  description?: string;
}

export interface Poll {
  id: string;
  type: PollType;
  category: PollCategory;
  title: string;
  description: string;
  massDate?: string;
  massDates?: MassOption[];
  startDate: string;
  endDate: string;
  status: PollStatus;
  targetDate?: string;
  ministryType?: MinistryType;
  isMultiSelect?: boolean;
  createdBy?: string;
  creatorName?: string;
  assignments?: {
    [massDate: string]: {
      [userId: string]: string; // role name
    };
  };
  completedAssignments?: string[]; // 'lector', 'altar_server', 'usher', 'ppt'
  createdAt: string;
}

export const COMMITTEE_ROLES = {
  lector: ['Commentator', 'Lector 1', 'Lector 2'],
  altar_server: ['Altar Server 1', 'Altar Server 2', 'Altar Server 3', 'Altar Server 4'],
  usher: ['Usher 1', 'Usher 2', 'Usher 3', 'Usher 4'],
  ppt: ['PPT Operator']
};

export const ROLE_COLORS: Record<string, string> = {
  'Commentator': 'bg-red-100 text-red-600',
  'Lector 1': 'bg-orange-100 text-orange-600',
  'Lector 2': 'bg-orange-100 text-orange-600',
  'Altar Server 1': 'bg-yellow-100 text-yellow-600',
  'Altar Server 2': 'bg-yellow-100 text-yellow-600',
  'Altar Server 3': 'bg-yellow-100 text-yellow-600',
  'Altar Server 4': 'bg-yellow-100 text-yellow-600',
  'Usher 1': 'bg-green-100 text-green-600',
  'Usher 2': 'bg-green-100 text-green-600',
  'Usher 3': 'bg-green-100 text-green-600',
  'Usher 4': 'bg-green-100 text-green-600',
  'PPT Operator': 'bg-blue-100 text-blue-600',
};

export interface PollResponse {
  id?: string;
  pollId: string;
  userId: string;
  userDisplayName: string;
  attendance?: AttendanceType;
  selectedOptions?: string[];
  notes?: string;
  toiletOk?: boolean;
  submittedAt: string;
}

export interface DutyAssignment {
  id?: string;
  pollId?: string;
  userId: string;
  userDisplayName: string;
  type: DutyType;
  date: string;
  slot?: string;
  assignedBy: string;
  assignedAt: string;
  // Execution tracking fields
  completed?: 'done' | 'not_done';
  reason?: string;
  approvedByLeader?: boolean;
  leaderApprovedAt?: string;
  leaderApprovedBy?: string;
  leaderRemarks?: string;
}

export interface Resource {
  id?: string;
  title: string;
  description?: string;
  ministry: string;
  fileUrl: string;
  fileType: string;
  uploadedBy: string;
  createdAt: string;
}

export interface Announcement {
  id?: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface Transaction {
  id?: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string;
  processedBy: string;
  processedByName: string;
  lastModifiedBy?: string;
  lastModifiedByName?: string;
  status?: 'pending' | 'approved';
  approvedBy?: string;
  approvedByName?: string;
  receiptUrl?: string;
  createdAt: any;
  updatedAt: any;
}

export interface AccountingCategory {
  id?: string;
  name: string;
  type: 'income' | 'expense';
  createdAt: any;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  status: 'unread' | 'read' | 'archived';
  createdAt: any;
}

