import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Poll, PollResponse, UserProfile, DutyAssignment } from '../types';
import { balanceChoreSlots, ChoreAttendee, ChoreDutyTemplate, AutoChoreAssignment } from '../services/dutyService';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Edit2, Check, Sparkles, Send, Mail, User, AlertTriangle, BarChart3, RotateCw, Calendar, CheckSquare, XSquare, HelpCircle, Save, Sliders, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { sendGmail } from '../lib/gmail';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';

interface ChoreCommitteeDashboardProps {
  poll: Poll;
  pollResponses: PollResponse[];
  profile: UserProfile | null;
  users: UserProfile[];
}

const DEFAULT_TEMPLATES: Omit<ChoreDutyTemplate, 'id'>[] = [
  { name: 'Mop the Altar', group: 'cleaning', requiredPersons: 1, restrictedToToiletOk: false },
  { name: 'Vacuum the church', group: 'cleaning', requiredPersons: 2, restrictedToToiletOk: false },
  { name: 'Toilet', group: 'cleaning', requiredPersons: 2, restrictedToToiletOk: true },
  { name: 'Arrange pew etc.', group: 'cleaning', requiredPersons: 1, restrictedToToiletOk: false },
  { name: 'Preparation', group: 'kitchen', requiredPersons: 1, restrictedToToiletOk: false },
  { name: 'Dish washing', group: 'kitchen', requiredPersons: 1, restrictedToToiletOk: false }
];

export default function ChoreCommitteeDashboard({ poll, pollResponses, profile, users }: ChoreCommitteeDashboardProps) {
  // Config & Administration Permission
  const isAdmin = (profile?.roles || []).some(r => ['admin', 'president', 'vice_president', 'secretary', 'auditor', 'kitchen_leader', 'cleaning_leader'].includes(r)) || profile?.email === 'kcfc.jp@gmail.com';
  const isHighLevelAdmin = (profile?.roles || []).some(r => ['admin', 'president'].includes(r)) || profile?.email === 'kcfc.jp@gmail.com';

  const [activeTab, setActiveTab] = useState<'matrix' | 'templates' | 'reports'>('matrix');
  const [templates, setTemplates] = useState<ChoreDutyTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Suggested / Edited Assignments
  // Structure: array of { templateId, name, group, assignedUserId, assignedUserName, isToiletOk, originalFromBalancer }
  const [stagedAssignments, setStagedAssignments] = useState<Array<{
    id: string; // unique slot ID
    templateName: string;
    group: 'cleaning' | 'kitchen';
    restrictedToToiletOk: boolean;
    userId: string;
    userDisplayName: string;
  }>>([]);

  const [isModifyingCompleted, setIsModifyingCompleted] = useState(false);

  // Historical Duty Records (for workload calculation)
  const [historicalDuties, setHistoricalDuties] = useState<DutyAssignment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Deduplicate existing duties by userId and slot/chore name to handle past duplicates cleanly
  const existingPollDuties = (() => {
    const list: DutyAssignment[] = [];
    const seen = new Set<string>();
    historicalDuties
      .filter(hd => hd.pollId === poll.id)
      .forEach(hd => {
        const key = `${hd.userId}-${hd.slot}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push(hd);
        }
      });
    return list;
  })();
  const hasExistingAssignments = existingPollDuties.length > 0;

  const loadExistingForEditing = () => {
    const mapped = existingPollDuties.map((d, index) => ({
      id: d.id || `slot_edit_${index}_${Date.now()}`,
      templateName: d.slot || '',
      group: d.type as 'cleaning' | 'kitchen',
      restrictedToToiletOk: templates.find(t => t.name === d.slot)?.restrictedToToiletOk || false,
      userId: d.userId,
      userDisplayName: d.userDisplayName
    }));
    setStagedAssignments(mapped);
    setIsModifyingCompleted(true);
    setAlertStatus("Loaded official assignments for modification! Update the assignments below and click Save.");
  };

  // Email state
  const [sendingAlerts, setSendingAlerts] = useState(false);
  const [alertStatus, setAlertStatus] = useState<string | null>(null);

  // Broadcast modal states
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'group' | 'selected'>('all');
  const [broadcastType, setBroadcastType] = useState<'individual' | 'summary'>('individual');
  const [selectedGroup, setSelectedGroup] = useState<'cleaning' | 'kitchen'>('cleaning');
  const [selectedUserIdsForBroadcast, setSelectedUserIdsForBroadcast] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState(`[KCFC] Chore Assignments Update`);
  const [customMessage, setCustomMessage] = useState(`The chore assignments have been finalized for the upcoming Mass.`);

  // Template Editing and Addition Form State
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState<Omit<ChoreDutyTemplate, 'id'>>({
    name: '',
    group: 'cleaning',
    requiredPersons: 1,
    restrictedToToiletOk: false
  });
  const [showAddTemplate, setShowAddTemplate] = useState(false);

  // Attendance history structure
  const [pastPolls, setPastPolls] = useState<Poll[]>([]);
  const [pastResponses, setPastResponses] = useState<Record<string, PollResponse[]>>({});

  // 1. Fetch & Initialize Templates
  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const snap = await getDocs(collection(db, 'chore_duty_templates'));
      if (snap.empty) {
        // Seed default templates
        const seeded: ChoreDutyTemplate[] = [];
        for (const t of DEFAULT_TEMPLATES) {
          const docRef = await addDoc(collection(db, 'chore_duty_templates'), t);
          seeded.push({ id: docRef.id, ...t });
        }
        setTemplates(seeded);
      } else {
        setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChoreDutyTemplate)));
      }
    } catch (err) {
      console.error("Failed to fetch templates", err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // 2. Fetch Duty History
  const fetchDutyHistory = async () => {
    setLoadingHistory(true);
    try {
      const snap = await getDocs(collection(db, 'duties'));
      setHistoricalDuties(snap.docs.map(d => ({ id: d.id, ...d.data() } as DutyAssignment)));
    } catch (err) {
      console.error("Failed to fetch duty history", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 3. Fetch past polls for reporting
  const fetchPastPolls = async () => {
    try {
      const snap = await getDocs(collection(db, 'polls'));
      const pollsList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Poll)).filter(p => p.category === 'core_member');
      setPastPolls(pollsList);
      
      const responseMap: Record<string, PollResponse[]> = {};
      for (const p of pollsList) {
        const respSnap = await getDocs(collection(db, `polls/${p.id}/responses`));
        responseMap[p.id] = respSnap.docs.map(d => d.data() as PollResponse);
      }
      setPastResponses(responseMap);
    } catch (err) {
      console.error("Error fetching past polls", err);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchDutyHistory();
    fetchPastPolls();
    if (poll) {
      const pDate = poll.massDate ? format(new Date(poll.massDate), 'MMM dd, yyyy') : '';
      setCustomSubject(`[KCFC] Chore Assignments Update: ${pDate}`);
    }
  }, [poll.id, poll.massDate]);

  // List of YES responders to this poll, with toiletOk checked from their verified profile ministries
  const yesResponders = pollResponses.filter(r => r.attendance === 'yes').map(r => {
    const userProfile = users.find(u => u.uid === r.userId);
    const isCleaning = userProfile?.ministries?.includes('cleaning') || false;
    const isKitchen = userProfile?.ministries?.includes('kitchen') || false;
    const isToiletOk = isCleaning && userProfile?.ministries?.includes('cleaning_toilet_ok');
    return {
      ...r,
      toiletOk: !!isToiletOk,
      isCleaning,
      isKitchen
    };
  });

  // Trigger Automatic suggested assignment of duties
  const triggerAutoSuggest = () => {
    if (yesResponders.length === 0) {
      alert("No YES responders are available for this poll to suggest assignments.");
      return;
    }

    const attendees: ChoreAttendee[] = yesResponders.map(r => ({
      userId: r.userId,
      userDisplayName: r.userDisplayName,
      toiletOk: !!r.toiletOk,
      isKitchen: !!r.isKitchen,
      isCleaning: !!r.isCleaning
    }));

    const suggestedAndBalanced = balanceChoreSlots(attendees, historicalDuties, templates);
    
    // Map of template details
    const mapping = suggestedAndBalanced.map((item, idx) => {
      const matchingTemplate = templates.find(t => t.name === item.dutyName);
      return {
        id: `slot_${idx}_${Date.now()}`,
        templateName: item.dutyName,
        group: item.group,
        restrictedToToiletOk: matchingTemplate?.restrictedToToiletOk || false,
        userId: item.userId,
        userDisplayName: item.userDisplayName
      };
    });

    setStagedAssignments(mapping);
    setAlertStatus("Successfully calculated a resilient balanced schedule suggestion!");
  };

  // Override / Change specific slot user
  const handleOverrideSlot = (slotId: string, newUserId: string) => {
    const matchingUser = yesResponders.find(u => u.userId === newUserId);
    if (!matchingUser) return;

    setStagedAssignments(prev => prev.map(slot => {
      if (slot.id === slotId) {
        return {
          ...slot,
          userId: newUserId,
          userDisplayName: matchingUser.userDisplayName
        };
      }
      return slot;
    }));
  };

  // Save changes/Approve the staged duties to the official duties collection
  const handleApproveAssignments = async () => {
    if (stagedAssignments.length === 0) {
      alert("No staged assignments exist to approve.");
      return;
    }
    
    setSendingAlerts(true);
    setAlertStatus(isModifyingCompleted ? "Updating official assignments & dispatching modified alerts..." : "Saving official assignments and dispatching alerts...");

    try {
      const batchDuties = writeBatch(db);
      const uniqueSelectedUsers = new Set<string>();

      // Delete existing assignments for this poll first
      const oldDuties = historicalDuties.filter(hd => hd.pollId === poll.id);
      for (const d of oldDuties) {
        if (d.id) {
          batchDuties.delete(doc(db, 'duties', d.id));
        }
      }

      for (const slot of stagedAssignments) {
        uniqueSelectedUsers.add(slot.userId);
        const dutyRef = doc(collection(db, 'duties'));
        const officialDuty: Omit<DutyAssignment, 'id'> = {
          pollId: poll.id,
          userId: slot.userId,
          userDisplayName: slot.userDisplayName,
          type: slot.group,
          date: poll.massDate || new Date().toISOString(),
          slot: slot.templateName,
          assignedBy: profile?.displayName || 'System Administrator',
          assignedAt: new Date().toISOString()
        };

        batchDuties.set(dutyRef, {
          ...officialDuty,
          assignedAt: serverTimestamp()
        });

        // Add user system notification
        const notificationRef = doc(collection(db, 'notifications'));
        batchDuties.set(notificationRef, {
          userId: slot.userId,
          title: isModifyingCompleted ? '🔁 Chore Duty Assignment Updated' : '🚨 New Chore Duty Assigned!',
          message: isModifyingCompleted
            ? `Your chore assignment has been updated: "${slot.templateName}" (${slot.group}) for Mass on ${poll.massDate ? format(new Date(poll.massDate), 'EEEE, MMM dd') : 'the target date'}.`
            : `You are scheduled for: "${slot.templateName}" (${slot.group}) for Mass on ${poll.massDate ? format(new Date(poll.massDate), 'EEEE, MMM dd') : 'the target date'}.`,
          type: 'system',
          status: 'unread',
          link: '/duties',
          createdAt: serverTimestamp()
        });
      }

      await batchDuties.commit();
      
      const wasModifying = isModifyingCompleted;
      setIsModifyingCompleted(false);
      setAlertStatus("Saved to duties database successfully! Dispatching notification emails...");

      // Send Gmail alerting (HTML inline tables)
      try {
        const resultsArray = Array.from(uniqueSelectedUsers).map(userId => {
          const userProfile = users.find(u => u.uid === userId);
          const tasks = stagedAssignments.filter(s => s.userId === userId).map(s => s.templateName);
          const recipientName = userProfile?.nickname?.trim() || userProfile?.displayName || 'Community Member';
          return {
            email: userProfile?.email || '',
            name: recipientName,
            tasks: tasks.join(', ')
          };
        }).filter(u => u.email);

        for (const recipient of resultsArray) {
          const subject = wasModifying
            ? `[UPDATE] [KCFC] Chore Assignment Updated for Mass: ${poll.massDate ? format(new Date(poll.massDate), 'MMM dd, yyyy') : ''}`
            : `[KCFC] Chore Assignment on Mass: ${poll.massDate ? format(new Date(poll.massDate), 'MMM dd, yyyy') : ''}`;
          
          const htmlContent = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 12px; background-color: #fafafa;">
              <h2 style="color: #4A4A35; border-bottom: 2px solid #5A5A40; padding-bottom: 10px; font-family: serif;">Koiwa Church Filipino Community</h2>
              <p>Hello <strong>${recipient.name}</strong>,</p>
              <p>${wasModifying ? 'Your chore duty assignment has been <strong>updated/modified</strong>' : 'You have been officially scheduled/assigned'} for the following chore duties for the Mass on <strong>${poll.massDate ? format(new Date(poll.massDate), 'EEEE, MMMM dd, yyyy') : 'the scheduled Sunday'}</strong>:</p>
              
              <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; border-left: 4px solid #5A5A40; margin: 15px 0;">
                <p style="margin: 0; font-size: 16px; font-weight: bold; color: #333;">${recipient.tasks}</p>
                <p style="margin: 5px 0 0; font-size: 11px; color: #777;">Chore Committee Section (${wasModifying ? 'Updated Assignment' : 'Single Mass Scheduling'})</p>
              </div>
              
              <p>Please log in to the KCFC portal to review your updated duties, view detailed instructions, or request substitution if required.</p>
              <p style="margin-top: 30px; font-size: 11px; color: #999; text-align: center; border-t: 1px solid #eee; pt: 15px;">
                This represents an automated official notification from KCFC Secretariat Office.
              </p>
            </div>
          `;
          try {
            await sendGmail(recipient.email, subject, htmlContent);
          } catch (mErr) {
            console.warn(`Could not dispatch Gmail to ${recipient.email}:`, mErr);
          }
        }
        setAlertStatus(wasModifying ? "Modified assignments saved and updated emails sent successfully!" : "Saved and emailed successfully!");
        fetchDutyHistory();
      } catch (emAllErr) {
        console.error("Failed emails step", emAllErr);
        setAlertStatus("Duties saved successfully, but notification dispatch failed. Please check VITE_CLIENT_ID configuration (Secrets).");
      }
    } catch (err) {
      console.error(err);
      setAlertStatus("Save failed: " + (err as Error).message);
    } finally {
      setSendingAlerts(false);
    }
  };

  const handleSendEmailsWithoutModifying = () => {
    if (existingPollDuties.length === 0) {
      alert("No assignments exist to notify.");
      return;
    }
    // Initialize with all assigned user IDs
    const assignedUserIds = Array.from(new Set(existingPollDuties.map(d => d.userId)));
    setSelectedUserIdsForBroadcast(assignedUserIds);
    setIsBroadcastModalOpen(true);
  };

  const getChoreSummaryHtml = () => {
    const cleaningDuties = existingPollDuties.filter(d => d.type === 'cleaning');
    const kitchenDuties = existingPollDuties.filter(d => d.type === 'kitchen');

    let html = `
      <div style="margin-top: 25px; font-family: sans-serif;">
        <h3 style="color: #5A5A40; border-bottom: 2px solid #5A5A40; padding-bottom: 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 15px;">Finalized Chore Schedule Summary:</h3>
    `;

    if (cleaningDuties.length > 0) {
      html += `
        <div style="margin-bottom: 20px;">
          <h4 style="color: #7a7a55; font-size: 12px; text-transform: uppercase; margin-bottom: 8px; font-family: sans-serif; font-weight: bold;">Cleaning Committee</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 15px;">
            <thead>
              <tr style="background-color: #f4f4f0; text-align: left; color: #4A4A35; border-bottom: 2px solid #cbd5e1;">
                <th style="padding: 10px; border: 1px solid #e5e5df; font-weight: 700;">Chore Duty</th>
                <th style="padding: 10px; border: 1px solid #e5e5df; font-weight: 700;">Assigned Member</th>
              </tr>
            </thead>
            <tbody>
              ${cleaningDuties.map(d => `
                <tr style="border-bottom: 1px solid #e5e5df;">
                  <td style="padding: 10px; border: 1px solid #e5e5df; font-weight: 600;">${d.slot}</td>
                  <td style="padding: 10px; border: 1px solid #e5e5df; font-weight: bold; color: #5A5A40;">${d.userDisplayName}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (kitchenDuties.length > 0) {
      html += `
        <div>
          <h4 style="color: #7a7a55; font-size: 12px; text-transform: uppercase; margin-bottom: 8px; font-family: sans-serif; font-weight: bold;">Kitchen Committee</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 15px;">
            <thead>
              <tr style="background-color: #f4f4f0; text-align: left; color: #4A4A35; border-bottom: 2px solid #cbd5e1;">
                <th style="padding: 10px; border: 1px solid #e5e5df; font-weight: 700;">Chore Duty</th>
                <th style="padding: 10px; border: 1px solid #e5e5df; font-weight: 700;">Assigned Member</th>
              </tr>
            </thead>
            <tbody>
              ${kitchenDuties.map(d => `
                <tr style="border-bottom: 1px solid #e5e5df;">
                  <td style="padding: 10px; border: 1px solid #e5e5df; font-weight: 600;">${d.slot}</td>
                  <td style="padding: 10px; border: 1px solid #e5e5df; font-weight: bold; color: #5A5A40;">${d.userDisplayName}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    html += `
      </div>
    `;
    return html;
  };

  const handleBroadcastEmails = async () => {
    const assignedUserIds = Array.from(new Set(existingPollDuties.map(d => d.userId)));
    const assignedProfiles = users.filter(u => assignedUserIds.includes(u.uid));

    let recipientUsers: UserProfile[] = [];
    if (broadcastTarget === 'all') {
      recipientUsers = assignedProfiles;
    } else if (broadcastTarget === 'selected') {
      recipientUsers = assignedProfiles.filter(u => selectedUserIdsForBroadcast.includes(u.uid));
    } else if (broadcastTarget === 'group') {
      const usersInGroup = existingPollDuties
        .filter(d => d.type === selectedGroup)
        .map(d => d.userId);
      recipientUsers = assignedProfiles.filter(u => usersInGroup.includes(u.uid));
    }

    if (recipientUsers.length === 0) {
      alert("No recipients selected or matching the criteria.");
      return;
    }

    if (!confirm(`Are you sure you want to send email notifications to ${recipientUsers.length} selected member(s)?`)) {
      return;
    }

    setSendingAlerts(true);
    setAlertStatus("Sending chore notification emails...");

    try {
      const baseUrl = window.location.origin;
      let successCount = 0;

      const batch = writeBatch(db);
      recipientUsers.forEach(u => {
        const notificationRef = doc(collection(db, 'notifications'));
        batch.set(notificationRef, {
          userId: u.uid,
          title: customSubject,
          message: customMessage,
          type: 'broadcast',
          status: 'unread',
          link: '/duties',
          createdAt: serverTimestamp()
        });
      });
      await batch.commit();

      const summaryTableHtml = broadcastType === 'summary' ? getChoreSummaryHtml() : '';

      for (const recipient of recipientUsers) {
        if (!recipient.email) continue;

        let contentHtml = '';
        const recipientName = recipient.nickname?.trim() || recipient.displayName || 'Committee Member';

        if (broadcastType === 'summary') {
          contentHtml = summaryTableHtml;
        } else {
          const tasks = existingPollDuties
            .filter(d => d.userId === recipient.uid)
            .map(d => d.slot);
          const tasksListStr = tasks.length > 0 ? tasks.join(', ') : 'No scheduled duties';
          
          contentHtml = `
            <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; border-left: 4px solid #5A5A40; margin: 15px 0;">
              <p style="margin: 0; font-size: 16px; font-weight: bold; color: #333;">${tasksListStr}</p>
              <p style="margin: 5px 0 0; font-size: 11px; color: #777;">Your Chore Duties</p>
            </div>
          `;
        }

        const body = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 12px; background-color: #fafafa;">
            <h2 style="color: #4A4A35; border-bottom: 2px solid #5A5A40; padding-bottom: 10px; font-family: serif;">Koiwa Church Filipino Community</h2>
            <p>Dear <strong>${recipientName}</strong>,</p>
            <p>${customMessage.replace(/\n/g, '<br/>')}</p>
            
            ${contentHtml}
            
            <p style="margin-top: 35px;">Please log in to the KCFC portal to review your duties and view detailed instructions.</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/duties" style="background-color: #5A5A40; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Go to KCFC Portal
              </a>
            </p>
            <p style="margin-top: 30px; font-size: 11px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 15px;">
              This represents an automated official notification from KCFC Secretariat Office.
            </p>
          </div>
        `;

        try {
          await sendGmail(recipient.email, customSubject, body);
          successCount++;
        } catch (mErr) {
          console.warn(`Could not dispatch Gmail to ${recipient.email}:`, mErr);
        }
      }

      setAlertStatus(`Emails sent successfully to ${successCount} member(s)!`);
      setIsBroadcastModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setAlertStatus("Failed sending emails: " + err.message);
    } finally {
      setSendingAlerts(false);
    }
  };

  // Check how many duties a user is already staged for in this run
  const getUserStagedCount = (userId: string) => {
    return stagedAssignments.filter(s => s.userId === userId).length;
  };

  // Manage templates
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      if (editingTemplateId) {
        await updateDoc(doc(db, 'chore_duty_templates', editingTemplateId), templateForm);
        setTemplates(prev => prev.map(t => t.id === editingTemplateId ? { id: editingTemplateId, ...templateForm } as ChoreDutyTemplate : t));
        setEditingTemplateId(null);
      } else {
        const docRef = await addDoc(collection(db, 'chore_duty_templates'), templateForm);
        setTemplates(prev => [...prev, { id: docRef.id, ...templateForm } as ChoreDutyTemplate]);
        setShowAddTemplate(false);
      }
      setTemplateForm({ name: '', group: 'cleaning', requiredPersons: 1, restrictedToToiletOk: false });
      setAlertStatus("Chore duty templates updated successfully.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveTemplateInline = async () => {
    if (!isAdmin || !editingTemplateId) return;
    try {
      await updateDoc(doc(db, 'chore_duty_templates', editingTemplateId), templateForm);
      setTemplates(prev => prev.map(t => t.id === editingTemplateId ? { id: editingTemplateId, ...templateForm } as ChoreDutyTemplate : t));
      setEditingTemplateId(null);
      setTemplateForm({ name: '', group: 'cleaning', requiredPersons: 1, restrictedToToiletOk: false });
      setAlertStatus("Chore duty template saved successfully.");
    } catch (err) {
      console.error(err);
      setAlertStatus("Failed to save duty template: " + (err as Error).message);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!isAdmin || !confirm("Are you sure you want to delete this duty from the template layout?")) return;
    try {
      await deleteDoc(doc(db, 'chore_duty_templates', id));
      setTemplates(prev => prev.filter(t => t.id !== id));
      setAlertStatus("Duty template removed.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartEditTemplate = (t: ChoreDutyTemplate) => {
    setEditingTemplateId(t.id || null);
    setTemplateForm({
      name: t.name,
      group: t.group,
      requiredPersons: t.requiredPersons,
      restrictedToToiletOk: t.restrictedToToiletOk
    });
  };

  // Analytics helper maps
  const chartData = users
    .filter(u => u.isCoreMember)
    .map(u => {
      const pastCount = historicalDuties.filter(d => d.userId === u.uid).length;
      return {
        name: u.displayName,
        workload: pastCount
      };
    })
    .sort((a, b) => b.workload - a.workload);

  return (
    <div className="space-y-6 pt-6 border-t border-gray-100 dark:border-white/5">
      {/* Selector & Setup Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">Chore Committee Scheduling Matrix</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            For Mass: <strong className="text-gray-700 dark:text-[#8a8a65]">{poll.massDate ? format(new Date(poll.massDate), 'iiii, MMMM dd, yyyy') : 'No target date'}</strong>
          </p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-gray-100 dark:bg-[#252520] p-1 rounded-2xl border border-gray-200 dark:border-white/5 text-xs font-bold leading-none w-full sm:w-auto overflow-x-auto">
          <button 
            onClick={() => setActiveTab('matrix')}
            className={`flex-1 sm:flex-initial text-center px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${activeTab === 'matrix' ? 'bg-white dark:bg-[#141411] text-gray-800 dark:text-white shadow-sm' : 'text-gray-400 dark:text-gray-550 hover:text-gray-800 dark:hover:text-white'}`}
          >
            Duties Board
          </button>
          <button 
            onClick={() => setActiveTab('templates')}
            className={`flex-1 sm:flex-initial text-center px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${activeTab === 'templates' ? 'bg-white dark:bg-[#141411] text-gray-800 dark:text-white shadow-sm' : 'text-gray-400 dark:text-gray-550 hover:text-gray-800 dark:hover:text-white'}`}
          >
            Configure Chores
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={`flex-1 sm:flex-initial text-center px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${activeTab === 'reports' ? 'bg-white dark:bg-[#141411] text-gray-800 dark:text-white shadow-sm' : 'text-gray-400 dark:text-gray-550 hover:text-gray-800 dark:hover:text-white'}`}
          >
            Analytics & Reports
          </button>
        </div>
      </div>

      {alertStatus && (
        <div className="p-4 bg-[#5A5A40]/10 dark:bg-[#8a8a65]/10 border border-[#5A5A40]/20 dark:border-[#8a8a65]/20 text-[#5A5A40] dark:text-[#8a8a65] text-xs font-serif italic rounded-2xl flex items-center justify-between gap-4">
          <span>🚨 {alertStatus}</span>
          <button onClick={() => setAlertStatus(null)} className="font-bold hover:underline shrink-0">Dismiss</button>
        </div>
      )}

      {/* MATRIX CONTROLS BOARD */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          {/* Attendees check & suggestive prompt */}
          <div className="bg-gray-50 dark:bg-[#141411] p-5 sm:p-6 rounded-[2rem] border border-gray-100/50 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-700 dark:text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                📋 Attending Volunteers (YES Responses: {yesResponders.length})
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                {yesResponders.map(r => `${r.userDisplayName}${r.toiletOk ? ' (🚽 Toilet OK)' : ''}`).join(', ') || 'No volunteers answered YES yet.'}
              </p>
              {poll?.status !== 'closed' && (
                <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-x-2 gap-y-1.5 pt-1">
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-extrabold flex items-center gap-1 animate-pulse">
                    ⚠️ Attendance poll is still active. Please close the poll to enable generating balanced assignments.
                  </span>
                  {poll?.id && (
                    <Link
                      to={`/polls?id=${poll.id}`}
                      className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 px-3 py-1 rounded-full transition-all border border-blue-200 dark:border-blue-900/30 hover:scale-105 active:scale-95 whitespace-nowrap shadow-xs w-fit"
                    >
                      Go to Attendance Poll <ExternalLink size={9} />
                    </Link>
                  )}
                </div>
              )}
            </div>
            {isHighLevelAdmin && !hasExistingAssignments && !isModifyingCompleted && (
              <button
                onClick={triggerAutoSuggest}
                disabled={poll?.status !== 'closed'}
                className={cn(
                  "px-5 py-3.5 rounded-2xl font-bold leading-none text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 w-full md:w-auto shrink-0",
                  poll?.status === 'closed'
                    ? "bg-orange-600 hover:bg-orange-700 text-white cursor-pointer"
                    : "bg-gray-200 dark:bg-[#252520] text-gray-400 dark:text-gray-600 cursor-not-allowed"
                )}
                title={poll?.status !== 'closed' ? "The poll must be closed first to generate duties." : "Execute balancer algorithm to generate tasks"}
              >
                <Sparkles size={14} />
                Generate Balanced Assignments
              </button>
            )}
          </div>

          {/* Staged Board Group displays */}
          {stagedAssignments.length > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CLEANING DIVISION */}
                <div className="bg-white/50 dark:bg-[#1e1e1a]/50 border border-gray-100 dark:border-white/5 p-5 sm:p-6 rounded-[2.5rem] space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3">
                    <h4 className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2">🧹 Cleaning Committee Chores</h4>
                    <span className="text-[10px] bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">🧹 Cleaning</span>
                  </div>
                  <div className="space-y-3">
                    {stagedAssignments.filter(s => s.group === 'cleaning').map(slot => {
                      const responds = yesResponders.find(y => y.userId === slot.userId);
                      const toiletWarning = slot.restrictedToToiletOk && !responds?.toiletOk;
                      const doubleCount = getUserStagedCount(slot.userId);

                      return (
                        <div key={slot.id} className="p-4 bg-white dark:bg-[#141411] border border-gray-100 dark:border-white/5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 transition-all hover:shadow-xs">
                          <div className="flex-1">
                            <span className="text-xs font-extrabold text-gray-800 dark:text-[#f5f5f0] block">{slot.templateName}</span>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              {toiletWarning && (
                                <span className="text-[9px] bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                                  <AlertTriangle size={8} /> Needs Toilet OK
                                </span>
                              )}
                              {doubleCount > 1 && (
                                <span className="text-[9px] bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md font-bold">
                                  🔁 Assigned to {doubleCount} jobs
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Select member overrides */}
                          <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 dark:border-white/5">
                            <span className="text-[10px] text-gray-400 dark:text-gray-550 font-mono">Volunteer:</span>
                            <select
                              value={slot.userId}
                              onChange={(e) => handleOverrideSlot(slot.id, e.target.value)}
                              disabled={!isAdmin}
                              className="px-3 py-2 bg-gray-50 dark:bg-[#252520] text-gray-800 dark:text-[#f5f5f0] border border-gray-100 dark:border-white/5 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer max-w-[150px] sm:max-w-none"
                            >
                              {(() => {
                                const eligible = yesResponders.filter(vr => !!vr.isCleaning);
                                const list = eligible.length > 0 ? eligible : yesResponders;
                                return list.map(vr => {
                                  const pastMatches = historicalDuties.filter(hd => hd.userId === vr.userId).length;
                                  return (
                                    <option key={vr.userId} value={vr.userId} className="bg-white dark:bg-[#1e1e1a] text-gray-800 dark:text-white">
                                      {vr.userDisplayName} (Load: {pastMatches}){vr.toiletOk ? ' 🚽' : ''}
                                    </option>
                                  );
                                });
                              })()}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* KITCHEN DIVISION */}
                <div className="bg-white/50 dark:bg-[#1e1e1a]/50 border border-gray-100 dark:border-white/5 p-5 sm:p-6 rounded-[2.5rem] space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3">
                    <h4 className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2">🍳 Kitchen Committee Chores</h4>
                    <span className="text-[10px] bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">🍳 Kitchen</span>
                  </div>
                  <div className="space-y-3">
                    {stagedAssignments.filter(s => s.group === 'kitchen').map(slot => {
                      const doubleCount = getUserStagedCount(slot.userId);

                      return (
                        <div key={slot.id} className="p-4 bg-white dark:bg-[#141411] border border-gray-100 dark:border-white/5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 transition-all hover:shadow-xs">
                          <div className="flex-1">
                            <span className="text-xs font-extrabold text-gray-800 dark:text-[#f5f5f0] block">{slot.templateName}</span>
                            {doubleCount > 1 && (
                              <span className="text-[9px] bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md font-bold block w-fit mt-1.5">
                                🔁 Assigned to {doubleCount} jobs
                              </span>
                            )}
                          </div>

                          {/* Select member overrides */}
                          <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 dark:border-white/5">
                            <span className="text-[10px] text-gray-400 dark:text-gray-550 font-mono">Volunteer:</span>
                            <select
                              value={slot.userId}
                              onChange={(e) => handleOverrideSlot(slot.id, e.target.value)}
                              disabled={!isAdmin}
                              className="px-3 py-2 bg-gray-50 dark:bg-[#252520] text-gray-800 dark:text-[#f5f5f0] border border-gray-100 dark:border-white/5 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer max-w-[150px] sm:max-w-none"
                            >
                              {(() => {
                                const eligible = yesResponders.filter(vr => !!vr.isKitchen);
                                const list = eligible.length > 0 ? eligible : yesResponders;
                                return list.map(vr => {
                                  const pastMatches = historicalDuties.filter(hd => hd.userId === vr.userId).length;
                                  return (
                                    <option key={vr.userId} value={vr.userId} className="bg-white dark:bg-[#1e1e1a] text-gray-800 dark:text-white">
                                      {vr.userDisplayName} (Load: {pastMatches}){vr.toiletOk ? ' 🚽' : ''}
                                    </option>
                                  );
                                });
                              })()}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* SAVE / DISPATCH CONTROLS */}
              {isAdmin && (
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 font-sans w-full">
                  {isModifyingCompleted && (
                    <button
                      type="button"
                      onClick={() => {
                        setStagedAssignments([]);
                        setIsModifyingCompleted(false);
                        setAlertStatus("Cancelled modifications.");
                      }}
                      className="px-6 py-3.5 rounded-2xl bg-gray-100 dark:bg-[#252520] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#2d2d25] font-bold text-xs uppercase tracking-wider transition-all w-full sm:w-auto"
                    >
                      Cancel Overrides
                    </button>
                  )}
                  <button
                    onClick={handleApproveAssignments}
                    disabled={sendingAlerts}
                    className={cn(
                      "px-6 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 w-full sm:w-auto",
                      isModifyingCompleted 
                        ? "bg-amber-600 hover:bg-amber-700 text-white" 
                        : "bg-[#5A5A40] dark:bg-[#8a8a65] text-white dark:text-[#11110f] hover:bg-[#4a4a35] dark:hover:bg-[#a5a575]"
                    )}
                  >
                    <Send size={14} />
                    {sendingAlerts 
                      ? "Dispatching Alerts..." 
                      : isModifyingCompleted 
                        ? "Apply Modifications & Resend Alerts" 
                        : "Confirm & Send Notifications"}
                  </button>
                </div>
              )}
            </div>
          ) : hasExistingAssignments ? (
            <div className="p-6 sm:p-8 text-center bg-green-50/30 dark:bg-green-950/10 border border-green-100/50 dark:border-green-900/20 rounded-[2rem] space-y-4 font-sans">
              <div className="w-12 h-12 bg-green-100/60 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-700 dark:text-green-400 mx-auto">
                <CheckSquare size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-gray-800 dark:text-green-400">Duties Assignment Completed!</h4>
                <p className="text-[10px] text-green-600 dark:text-green-500 font-extrabold uppercase tracking-widest">Stated assignments are published officially</p>
              </div>
              <div className="bg-white dark:bg-[#141411] border border-gray-100 dark:border-white/5 rounded-3xl max-w-lg mx-auto overflow-hidden shadow-xs">
                <div className="p-4 bg-gray-50 dark:bg-[#1e1e1a] border-b border-gray-100 dark:border-white/5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Published chore roster
                </div>
                <div className="divide-y divide-gray-50 dark:divide-white/5 max-h-60 overflow-y-auto">
                  {existingPollDuties.map(d => (
                    <div key={d.id} className="p-4 flex items-center justify-between text-xs hover:bg-gray-50/50 dark:hover:bg-[#1e1e1a]/30">
                      <div className="text-left space-y-0.5">
                        <span className="font-bold text-gray-800 dark:text-white block">{d.slot}</span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-extrabold uppercase tracking-wider">Division: {d.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-gray-700 dark:text-[#f5f5f0]">{d.userDisplayName}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {isHighLevelAdmin && (
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={loadExistingForEditing}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold uppercase tracking-wider text-[10px] shadow-sm transition-all active:scale-95 hover:scale-[1.02] w-full sm:w-auto"
                  >
                    <Edit2 size={12} />
                    Modify Completed Assignment
                  </button>
                  <button
                    onClick={handleSendEmailsWithoutModifying}
                    disabled={sendingAlerts}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#5A5A40] hover:bg-[#4a4a35] dark:bg-[#8a8a65] dark:hover:bg-[#a5a575] text-white dark:text-[#11110f] rounded-xl font-bold uppercase tracking-wider text-[10px] shadow-sm transition-all active:scale-95 hover:scale-[1.02] w-full sm:w-auto disabled:opacity-50"
                  >
                    <Mail size={12} />
                    {sendingAlerts ? "Sending Emails..." : "Send Roles via Email"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 sm:p-12 text-center bg-gray-50/50 dark:bg-[#141411] border border-dashed border-gray-200 dark:border-white/5 rounded-[2rem] space-y-4">
              <Sliders className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-gray-700 dark:text-[#f5f5f0]">Assignments Are Staged Offline First</h4>
                <p className="text-[10px] text-gray-400 dark:text-gray-550 font-bold uppercase tracking-widest">Ready to align volunteers with chores</p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
                Click <strong className="text-gray-700 dark:text-gray-300">Generate Balanced Assignments</strong> above to execute the resilient load-balancer algorithm dynamically across past duties and current attendances.
              </p>
            </div>
          )}
        </div>
      )}

      {/* DYNAMIC CHORE TEMPLATE MANAGER */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-gray-800">Dynamic Chore Checklist templates</h4>
              <p className="text-[10px] text-gray-400">Manage required manpower and special exclusions for chores.</p>
            </div>
            {isAdmin && !showAddTemplate && (
              <button
                onClick={() => {
                  setEditingTemplateId(null);
                  setShowAddTemplate(true);
                }}
                className="px-4 py-2 border border-gray-200 hover:border-gray-800 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-1 transition-all"
              >
                <Plus size={12} /> Add Chore Definition
              </button>
            )}
          </div>

          {/* New / Edit form */}
          {showAddTemplate || editingTemplateId ? (
            <form onSubmit={handleSaveTemplate} className="p-6 bg-white dark:bg-[#1e1e1a] border border-gray-100 dark:border-white/5 rounded-[2rem] grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Duty Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Toilet, Vacuum Hall"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#252520] border border-gray-200 dark:border-white/10 rounded-xl text-xs focus:ring-1 focus:ring-[#5A5A40] text-gray-900 dark:text-white font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Group Division</label>
                <select
                  value={templateForm.group}
                  onChange={(e) => setTemplateForm({ ...templateForm, group: e.target.value as any })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#252520] border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white font-medium"
                >
                  <option value="cleaning" className="bg-white dark:bg-[#1e1e1a] text-gray-900 dark:text-white">Cleaning Committee</option>
                  <option value="kitchen" className="bg-white dark:bg-[#1e1e1a] text-gray-900 dark:text-white">Kitchen Committee</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Mandatory Persons Count</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={templateForm.requiredPersons}
                  onChange={(e) => setTemplateForm({ ...templateForm, requiredPersons: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#252520] border border-gray-200 dark:border-white/10 rounded-xl text-xs focus:ring-1 focus:ring-[#5A5A40] text-gray-900 dark:text-white font-medium"
                />
              </div>

              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="chk-toilet"
                  checked={templateForm.restrictedToToiletOk}
                  onChange={(e) => setTemplateForm({ ...templateForm, restrictedToToiletOk: e.target.checked })}
                  className="rounded border-gray-300 dark:border-white/10 text-[#5A5A40] focus:ring-[#5A5A40] h-4 w-4 bg-white dark:bg-[#252520]"
                />
                <label htmlFor="chk-toilet" className="text-[11px] font-bold text-gray-700 dark:text-gray-300 cursor-pointer">
                  🚽 Restrict only to "Toilet OK" members
                </label>
              </div>

              <div className="md:col-span-full flex items-center justify-end gap-2 text-xs pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddTemplate(false);
                    setEditingTemplateId(null);
                  }}
                  className="px-4 py-2 text-gray-400 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#5A5A40] text-white rounded-xl font-bold uppercase tracking-wider text-[10px]"
                >
                  Save Definition
                </button>
              </div>
            </form>
          ) : null}

          {/* Templates list grid */}
          <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-xs">
            {loadingTemplates ? (
              <p className="p-8 text-center text-xs text-gray-400">Loading duty configurations...</p>
            ) : templates.length === 0 ? (
              <p className="p-8 text-center text-xs text-gray-400">No duty definitions set up.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold uppercase tracking-widest text-[9px]">
                      <th className="px-6 py-3">Duty Checklist Name</th>
                      <th className="px-6 py-3">Division Group</th>
                      <th className="px-6 py-3">Mandatory Resourcing</th>
                      <th className="px-6 py-3">Special Restraint</th>
                      {isAdmin && <th className="px-6 py-3 text-right">Managements</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-medium">
                    {templates.map(t => {
                      const isEditingThisRow = editingTemplateId === t.id;
                      return (
                        <tr key={t.id} className={`hover:bg-gray-50/50 transition-colors ${isEditingThisRow ? 'bg-[#5A5A40]/5' : ''}`}>
                          <td className="px-6 py-4 font-bold text-gray-800">
                            {isEditingThisRow ? (
                              <input
                                type="text"
                                required
                                value={templateForm.name}
                                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                                className="w-full max-w-xs px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#5A5A40] bg-white dark:bg-[#1a1a16] text-gray-800 dark:text-white font-bold text-xs"
                              />
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span 
                                  className={isAdmin ? "cursor-pointer hover:underline hover:text-[#5A5A40] transition-colors" : ""}
                                  onClick={() => isAdmin && handleStartEditTemplate(t)}
                                  title={isAdmin ? "Click to edit inline" : ""}
                                >
                                  {t.name}
                                </span>
                                {isAdmin && <Edit2 size={10} className="text-gray-300 pointer-events-none" />}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {isEditingThisRow ? (
                              <select
                                value={templateForm.group}
                                onChange={(e) => setTemplateForm({ ...templateForm, group: e.target.value as any })}
                                className="px-2 py-1.5 border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#5A5A40] bg-white dark:bg-[#1a1a16] text-gray-800 dark:text-white font-medium text-[11px]"
                              >
                                <option value="cleaning">cleaning</option>
                                <option value="kitchen">kitchen</option>
                              </select>
                            ) : (
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${t.group === 'kitchen' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                                {t.group}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-bold text-gray-700">
                            {isEditingThisRow ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  required
                                  min={1}
                                  value={templateForm.requiredPersons}
                                  onChange={(e) => setTemplateForm({ ...templateForm, requiredPersons: parseInt(e.target.value) || 1 })}
                                  className="w-16 px-2 py-1.5 border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#5A5A40] bg-white dark:bg-[#1a1a16] text-gray-800 dark:text-white font-bold text-xs"
                                />
                                <span className="text-[10px] text-gray-400 font-bold">Person(s)</span>
                              </div>
                            ) : (
                              <span 
                                className={isAdmin ? "cursor-pointer hover:underline hover:text-[#5A5A40] transition-colors" : ""}
                                onClick={() => isAdmin && handleStartEditTemplate(t)}
                                title={isAdmin ? "Click to edit inline" : ""}
                              >
                                {t.requiredPersons} Person(s)
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {isEditingThisRow ? (
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={templateForm.restrictedToToiletOk}
                                  onChange={(e) => setTemplateForm({ ...templateForm, restrictedToToiletOk: e.target.checked })}
                                  className="rounded border-gray-300 text-[#5A5A40] focus:ring-[#5A5A40] h-4 w-4"
                                />
                                <span className="text-[10px] text-gray-500 font-bold">Toilet OK</span>
                              </label>
                            ) : t.restrictedToToiletOk ? (
                              <span className="text-[10px] text-amber-600 font-bold">🚽 Toilet Volunteers Only</span>
                            ) : (
                              <span className="text-[10px] text-gray-300">None</span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="px-6 py-4 text-right flex items-center justify-end gap-1.5">
                              {isEditingThisRow ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={handleSaveTemplateInline}
                                    className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all flex items-center justify-center cursor-pointer"
                                    title="Save Inline"
                                  >
                                    <Check size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingTemplateId(null);
                                      setTemplateForm({ name: '', group: 'cleaning', requiredPersons: 1, restrictedToToiletOk: false });
                                    }}
                                    className="p-1.5 bg-gray-400 hover:bg-gray-500 text-white rounded-lg transition-all flex items-center justify-center cursor-pointer"
                                    title="Cancel"
                                  >
                                    <XSquare size={12} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleStartEditTemplate(t)}
                                    className="p-1.5 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all"
                                    title="Edit Duty template"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={() => t.id && handleDeleteTemplate(t.id)}
                                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    title="Delete template definition"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ROTATION PERFORMANCE & PARTICIPATION REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* WORKLOAD DISTRIBUTION VISUALIZER CHART */}
            <div className="bg-white dark:bg-[#1e1e1a] border border-gray-100 dark:border-white/5 p-6 rounded-[2.5rem] space-y-4 shadow-sm">
              <div>
                <h4 className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-1.5">
                  <BarChart3 className="text-[#5A5A40] dark:text-[#8a8a65] w-4 h-4" /> Workload Distribution Balance
                </h4>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">Aggregated historical chore assignments per core member.</p>
              </div>

              <div className="h-64 w-full">
                {chartData.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic text-center leading-[16rem]">No data available to plot.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} angle={-30} textAnchor="end" height={50} />
                      <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '16px', border: '1px solid #f0f0f0', fontSize: '11px' }} 
                        labelClassName="font-bold text-gray-800"
                      />
                      <Bar dataKey="workload" maxBarSize={32} radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#4A4A35' : '#5A5A40'} opacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* VOLUNTEER ATTENDANCE RATIO SUMMARY MATRIX */}
            <div className="bg-white dark:bg-[#1e1e1a] border border-gray-100 dark:border-white/5 p-6 rounded-[2.5rem] space-y-4 shadow-sm">
              <div>
                <h4 className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-1.5">
                  <Calendar className="text-[#5A5A40] dark:text-[#8a8a65] w-4 h-4" /> Chore Core Group Responses Matrix
                </h4>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">Core members engagement and pre-attendance tracking summaries.</p>
              </div>

              <div className="max-h-64 overflow-y-auto border border-gray-100 dark:border-white/5 rounded-2xl">
                <table className="w-full text-left text-xs bg-white dark:bg-[#1e1e1a]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-[#252520] border-b border-gray-150 dark:border-white/5 text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest text-[9px] sticky top-0">
                      <th className="px-4 py-2.5">Core Member displayName</th>
                      <th className="px-2 py-2.5 text-center">Yes Count</th>
                      <th className="px-2 py-2.5 text-center">Unconfirmed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-white/5 font-medium text-gray-700 dark:text-gray-300">
                    {users.filter(u => u.isCoreMember).map(member => {
                      const flattened = Object.values(pastResponses).flat() as PollResponse[];
                      const totalYes = flattened.filter(r => r.userId === member.uid && r.attendance === 'yes').length;
                      const totalNo = flattened.filter(r => r.userId === member.uid && r.attendance === 'no').length;
                      
                      return (
                        <tr key={member.uid} className="hover:bg-gray-50 dark:hover:bg-[#252520]/40">
                          <td className="px-4 py-2 font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <div className="w-5 h-5 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-[10px] text-[#5A5A40] dark:text-[#8a8a65] font-bold">
                              {member.displayName.charAt(0)}
                            </div>
                            {member.displayName}
                          </td>
                          <td className="px-2 py-2 text-center text-green-600 dark:text-green-400 font-bold">{totalYes}</td>
                          <td className="px-2 py-2 text-center text-gray-400 dark:text-gray-500">{totalNo}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {isBroadcastModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#1c1c18] text-gray-800 dark:text-[#f5f5f0] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-150 dark:border-white/5 flex flex-col max-h-[90vh]">
            <div className="p-6 bg-[#5A5A40]/10 border-b border-[#5A5A40]/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="text-[#5A5A40] dark:text-[#8a8a65]" size={20} />
                <h4 className="font-black text-[#5A5A40] dark:text-[#8a8a65] uppercase tracking-wider text-sm">Broadcast Chore Assignments</h4>
              </div>
              <button 
                onClick={() => setIsBroadcastModalOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all text-gray-400 hover:text-gray-200 cursor-pointer"
              >
                <XSquare size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-sm">
              {/* Subject */}
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider text-gray-500 block">Email Subject</label>
                <input
                  type="text"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5A5A40] bg-transparent text-gray-800 dark:text-white font-medium"
                  placeholder="Subject line..."
                />
              </div>

              {/* Message */}
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider text-gray-500 block">Email Body Message</label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5A5A40] bg-transparent text-gray-800 dark:text-white font-medium"
                  placeholder="Custom announcement details..."
                />
                <p className="text-[10px] text-gray-400">This text will be followed by a details button.</p>
              </div>

              {/* Email Type Selector (Role vs Summary) */}
              <div className="space-y-2 border-t border-gray-100 dark:border-white/5 pt-4">
                <label className="text-xs font-black uppercase tracking-wider text-gray-500 block">Email Type</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 font-bold cursor-pointer text-xs">
                    <input 
                      type="radio" 
                      name="broadcastType" 
                      checked={broadcastType === 'individual'} 
                      onChange={() => setBroadcastType('individual')}
                      className="text-[#5A5A40] focus:ring-[#5A5A40]"
                    />
                    <span>Role of each member (Personalized)</span>
                  </label>
                  <label className="flex items-center gap-2 font-bold cursor-pointer text-xs">
                    <input 
                      type="radio" 
                      name="broadcastType" 
                      checked={broadcastType === 'summary'} 
                      onChange={() => setBroadcastType('summary')}
                      className="text-[#5A5A40] focus:ring-[#5A5A40]"
                    />
                    <span>Summary of the entire assignment</span>
                  </label>
                </div>
              </div>

              {/* Target Selector */}
              <div className="space-y-2 border-t border-gray-100 dark:border-white/5 pt-4">
                <label className="text-xs font-black uppercase tracking-wider text-gray-500 block">Select Recipients</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 font-bold cursor-pointer text-xs">
                    <input 
                      type="radio" 
                      name="broadcastTarget" 
                      checked={broadcastTarget === 'all'} 
                      onChange={() => setBroadcastTarget('all')}
                      className="text-[#5A5A40] focus:ring-[#5A5A40]"
                    />
                    <span>All Assigned</span>
                  </label>
                  <label className="flex items-center gap-2 font-bold cursor-pointer text-xs">
                    <input 
                      type="radio" 
                      name="broadcastTarget" 
                      checked={broadcastTarget === 'group'} 
                      onChange={() => setBroadcastTarget('group')}
                      className="text-[#5A5A40] focus:ring-[#5A5A40]"
                    />
                    <span>By Committee Group</span>
                  </label>
                  <label className="flex items-center gap-2 font-bold cursor-pointer text-xs">
                    <input 
                      type="radio" 
                      name="broadcastTarget" 
                      checked={broadcastTarget === 'selected'} 
                      onChange={() => setBroadcastTarget('selected')}
                      className="text-[#5A5A40] focus:ring-[#5A5A40]"
                    />
                    <span>Select Individually</span>
                  </label>
                </div>
              </div>

              {/* By Committee Group controls */}
              {broadcastTarget === 'group' && (
                <div className="bg-gray-50 dark:bg-[#141411] p-4 rounded-2xl border border-gray-100 dark:border-white/5 space-y-2.5">
                  <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1">Committee Group</span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700 dark:text-gray-300">
                      <input
                        type="radio"
                        name="selectedGroup"
                        checked={selectedGroup === 'cleaning'}
                        onChange={() => setSelectedGroup('cleaning')}
                        className="text-[#5A5A40] focus:ring-[#5A5A40]"
                      />
                      <span>Cleaning Committee</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700 dark:text-gray-300">
                      <input
                        type="radio"
                        name="selectedGroup"
                        checked={selectedGroup === 'kitchen'}
                        onChange={() => setSelectedGroup('kitchen')}
                        className="text-[#5A5A40] focus:ring-[#5A5A40]"
                      />
                      <span>Kitchen Committee</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Individual Members selection */}
              {broadcastTarget === 'selected' && (
                <div className="bg-gray-50 dark:bg-[#141411] p-4 rounded-2xl border border-gray-100 dark:border-white/5 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Select Assigned Members</span>
                    <div className="flex gap-2">
                      <button 
                        type="button" 
                        onClick={() => setSelectedUserIdsForBroadcast(Array.from(new Set(existingPollDuties.map(d => d.userId))))}
                        className="text-[10px] text-[#5A5A40] dark:text-[#8a8a65] font-black hover:underline cursor-pointer"
                      >
                        All
                      </button>
                      <span className="text-gray-300">|</span>
                      <button 
                        type="button" 
                        onClick={() => setSelectedUserIdsForBroadcast([])}
                        className="text-[10px] text-gray-400 font-black hover:underline cursor-pointer"
                      >
                        None
                      </button>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                    {Array.from(new Set(existingPollDuties.map(d => d.userId))).map(uid => {
                      const member = users.find(u => u.uid === uid);
                      if (!member) return null;
                      return (
                        <label key={member.uid} className="flex items-center justify-between cursor-pointer py-1 border-b border-gray-100/50 dark:border-white/5 last:border-0">
                          <span className="text-xs text-gray-700 dark:text-gray-300 font-bold">{member.displayName}</span>
                          <input
                            type="checkbox"
                            checked={selectedUserIdsForBroadcast.includes(member.uid)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUserIdsForBroadcast(prev => [...prev, member.uid]);
                              } else {
                                setSelectedUserIdsForBroadcast(prev => prev.filter(x => x !== member.uid));
                              }
                            }}
                            className="rounded text-[#5A5A40] focus:ring-[#5A5A40]"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 bg-gray-50 dark:bg-[#141411] border-t border-gray-100 dark:border-white/5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsBroadcastModalOpen(false)}
                className="px-4 py-2 bg-white dark:bg-[#1e1e1a] hover:bg-gray-100 dark:hover:bg-gray-850 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingAlerts}
                onClick={handleBroadcastEmails}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#5A5A40] hover:bg-[#4a4a35] dark:bg-[#8a8a65] dark:hover:bg-[#a5a575] text-white dark:text-[#11110f] rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md disabled:opacity-50 cursor-pointer"
              >
                <Mail size={14} />
                <span>{sendingAlerts ? "Sending..." : "Send Broadcast"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
