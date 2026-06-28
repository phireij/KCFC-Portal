import { db } from './firebase';
import { doc, writeBatch, collection, getDocs } from 'firebase/firestore';

export async function seedDatabase(callerUid: string, callerEmail: string) {
  // We can fetch existing collections to clear them completely and avoid duplicate/stray data
  const usersSnap = await getDocs(collection(db, 'users'));
  const templatesSnap = await getDocs(collection(db, 'chore_duty_templates'));
  const pollsSnap = await getDocs(collection(db, 'polls'));
  const transSnap = await getDocs(collection(db, 'accounting'));
  const catsSnap = await getDocs(collection(db, 'accounting_categories'));
  const annSnap = await getDocs(collection(db, 'announcements'));
  const msgSnap = await getDocs(collection(db, 'messages'));

  // Fetch responses inside polls
  const responseSnaps: { pollId: string; docs: any[] }[] = [];
  for (const pollDoc of pollsSnap.docs) {
    const respSnap = await getDocs(collection(db, 'polls', pollDoc.id, 'responses'));
    responseSnaps.push({ pollId: pollDoc.id, docs: respSnap.docs });
  }

  // Firestore batch size limit is 500 writes. We'll use a batch manager to auto-split operations.
  class BatchManager {
    private batches: any[] = [];
    private currentBatch = writeBatch(db);
    private operationCount = 0;

    addSet(ref: any, data: any) {
      this.currentBatch.set(ref, data);
      this.increment();
    }

    addDelete(ref: any) {
      this.currentBatch.delete(ref);
      this.increment();
    }

    private increment() {
      this.operationCount++;
      if (this.operationCount >= 400) {
        this.batches.push(this.currentBatch);
        this.currentBatch = writeBatch(db);
        this.operationCount = 0;
      }
    }

    async commit() {
      if (this.operationCount > 0) {
        this.batches.push(this.currentBatch);
      }
      for (const batch of this.batches) {
        await batch.commit();
      }
    }
  }

  const batchManager = new BatchManager();

  // 1. Delete previous dummy user records to keep the database tidy, but DO NOT delete real registered users!
  usersSnap.docs.forEach((uDoc) => {
    const data = uDoc.data();
    const isDummy = uDoc.id.startsWith('user_') || (data.email && data.email.endsWith('@kcfcjp.com'));
    if (isDummy && uDoc.id !== callerUid) {
      batchManager.addDelete(doc(db, 'users', uDoc.id));
    }
  });

  // 2. Delete all other collections completely to clean up dummy items
  templatesSnap.docs.forEach((d) => batchManager.addDelete(doc(db, 'chore_duty_templates', d.id)));
  transSnap.docs.forEach((d) => batchManager.addDelete(doc(db, 'accounting', d.id)));
  catsSnap.docs.forEach((d) => batchManager.addDelete(doc(db, 'accounting_categories', d.id)));
  annSnap.docs.forEach((d) => batchManager.addDelete(doc(db, 'announcements', d.id)));
  msgSnap.docs.forEach((d) => batchManager.addDelete(doc(db, 'messages', d.id)));

  // Delete subcollection responses first, then the polls themselves
  for (const rSnap of responseSnaps) {
    rSnap.docs.forEach((d) => {
      batchManager.addDelete(doc(db, 'polls', rSnap.pollId, 'responses', d.id));
    });
  }
  pollsSnap.docs.forEach((d) => batchManager.addDelete(doc(db, 'polls', d.id)));

  // Execute deletion transactions first
  await batchManager.commit();

  // Now build insertions for clean and correct records
  const insertBatch = new BatchManager();

  const isPhilip = callerEmail.toLowerCase() === 'kcfc.jp@gmail.com';

  // Current admin user registration/update (Philip Bombeo if logged in as kcfc.jp@gmail.com)
  const callerRef = doc(db, 'users', callerUid);
  insertBatch.addSet(callerRef, {
    uid: callerUid,
    email: callerEmail,
    displayName: isPhilip ? "Philip Bombeo" : "KCFC System Admin",
    nickname: isPhilip ? "Philip" : "Admin",
    photoURL: isPhilip 
      ? "https://ui-avatars.com/api/?name=Philip+Bombeo&background=1e293b&color=fff"
      : "https://ui-avatars.com/api/?name=KCFC+Admin&background=5A5A40&color=fff",
    roles: ["admin", "president", "member"],
    ministries: ["cleaning", "lector_commentator", "altar_server", "usher", "cleaning_toilet_ok"],
    isVerified: true,
    isCoreMember: true,
    isEmailVerified: true,
    phoneNumber: isPhilip ? "08043557227" : "+81-80-0000-0000",
    birthdate: "1985-05-15",
    homeAddress: "Kyoto-shi, Kamigyo-ku, KCFC Church HQ",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 3. Chore Duty Templates
  const templates = [
    { name: "Toilet Cleaning (Restricted)", group: "cleaning", requiredPersons: 1, restrictedToToiletOk: true },
    { name: "Vacuuming & Mopping", group: "cleaning", requiredPersons: 2, restrictedToToiletOk: false },
    { name: "Arrange Pews & Altar Preparations", group: "cleaning", requiredPersons: 2, restrictedToToiletOk: false },
    { name: "Kitchen Ingredients Preparation", group: "kitchen", requiredPersons: 2, restrictedToToiletOk: false },
    { name: "Dishwashing & Clean Up", group: "kitchen", requiredPersons: 2, restrictedToToiletOk: false },
  ];

  templates.forEach((t, index) => {
    const tRef = doc(db, 'chore_duty_templates', `template_${index + 1}`);
    insertBatch.addSet(tRef, t);
  });

  // 4. Active Polls
  const poll1Id = "poll_chore_june_28";
  const poll1 = {
    id: poll1Id,
    type: "weekly",
    category: "core_member",
    title: "Chore Committee Poll - Sunday, June 28, 2026",
    description: "Please RSVP your availability for kitchen and cleaning duties next Sunday.",
    status: "active",
    startDate: "2026-06-25T00:00:00Z",
    endDate: "2026-06-27T18:00:00Z",
    targetDate: "2026-06-28",
    createdBy: callerUid,
    creatorName: isPhilip ? "Philip Bombeo" : "KCFC Administration",
    createdAt: new Date().toISOString()
  };
  insertBatch.addSet(doc(db, 'polls', poll1Id), poll1);

  // Dynamically generate votes from real registered users in the database
  const activeRegisteredUsers = usersSnap.docs
    .map(doc => ({ uid: doc.id, ...doc.data() } as any))
    .filter(u => {
      const isDummy = u.uid.startsWith('user_') || (u.email && u.email.endsWith('@kcfcjp.com'));
      return u.uid === callerUid || !isDummy;
    });

  activeRegisteredUsers.forEach((v) => {
    const responseRef = doc(db, 'polls', poll1Id, 'responses', `vote_${v.uid}`);
    const hasToiletOk = v.ministries?.includes("cleaning_toilet_ok") || false;
    insertBatch.addSet(responseRef, {
      pollId: poll1Id,
      userId: v.uid,
      userDisplayName: v.displayName || v.nickname || "Community Member",
      attendance: "yes",
      selectedOptions: ['Attending & Ready'],
      toiletOk: hasToiletOk,
      submittedAt: new Date().toISOString()
    });
  });

  const poll2Id = "poll_mass_june_28";
  const poll2 = {
    id: poll2Id,
    type: "weekly",
    category: "standard",
    title: "Sunday Mass Attendance Poll (June 28, 2026)",
    description: "Standard community mass pre-attendance RSVP poll.",
    status: "active",
    startDate: "2026-06-25T00:00:00Z",
    endDate: "2026-06-27T18:00:00Z",
    targetDate: "2026-06-28",
    createdBy: callerUid,
    creatorName: isPhilip ? "Philip Bombeo" : "KCFC Administration",
    createdAt: new Date().toISOString()
  };
  insertBatch.addSet(doc(db, 'polls', poll2Id), poll2);

  // 5. Default Accounting Categories
  const categories = [
    { name: "Mass Collections", type: "income", description: "Regular offerings collected during Sunday Holy Masses." },
    { name: "Donations & Pledges", type: "income", description: "Voluntary community contributions, tithes, and special vows." },
    { name: "Kitchen & Refreshments Supplies", type: "expense", description: "Purchase of raw materials and ingredients for fellowship lunches." },
    { name: "Church Liturgical Materials", type: "expense", description: "Acolyte hosts, altar wine, flowers, candles, and vestments care." },
    { name: "Charity & Welfare Assistance", type: "expense", description: "Support packages dispatched to families in immediate financial duress." },
  ];

  categories.forEach((cat, idx) => {
    const catRef = doc(db, 'accounting_categories', `category_${idx + 1}`);
    insertBatch.addSet(catRef, { ...cat, createdAt: new Date().toISOString() });
  });

  // 6. Sample Accounting Transactions
  const transactions = [
    { date: "2026-06-14", type: "income", category: "Mass Collections", amount: 48500, processedBy: callerUid, description: "Solemnity of Corpus Christi Mass Offering" },
    { date: "2026-06-15", type: "expense", category: "Kitchen & Refreshments Supplies", amount: 12400, processedBy: callerUid, description: "Fresh meat, rice bundles, vegetables for fellowship" },
    { date: "2026-06-18", type: "income", category: "Donations & Pledges", amount: 30000, processedBy: callerUid, description: "Kyoto Core Group Annual Pledge Contribution" },
    { date: "2026-06-20", type: "expense", category: "Church Liturgical Materials", amount: 6500, processedBy: callerUid, description: "Altar hosts bundles and organic incense boxes" },
    { date: "2026-06-22", type: "expense", category: "Charity & Welfare Assistance", amount: 15000, processedBy: callerUid, description: "Emergency assistance package for sister Maria's recovery" }
  ];

  transactions.forEach((t, idx) => {
    const tRef = doc(db, 'accounting', `transaction_${idx + 1}`);
    insertBatch.addSet(tRef, { ...t, createdAt: new Date().toISOString() });
  });

  // 7. Announcements
  const announcements = [
    {
      title: "Chore Rotation System Integration",
      content: "Welcome to our new fully automated Chore Assignment and Rotation tracker! Commencing this Sunday, members can verify their duty schedules and report completed jobs with comments directly on their active dashboard.",
      status: "published",
      authorId: callerUid,
      authorName: isPhilip ? "Philip Bombeo" : "KCFC Administration",
      createdAt: new Date().toISOString()
    },
    {
      title: "Fellowship Lunch Coordination",
      content: "Let us coordinate details for our Feast Fellowship next month. Kitchen committee members are asked to respond to the active chore poll promptly to structure preparation work teams.",
      status: "published",
      authorId: callerUid,
      authorName: "Rosana Akiyama",
      createdAt: new Date().toISOString()
    }
  ];

  announcements.forEach((a, idx) => {
    const aRef = doc(db, 'announcements', `announcement_${idx + 1}`);
    insertBatch.addSet(aRef, a);
  });

  // 8. Contact Messages
  const messages = [
    {
      name: "Serafina Lopez",
      email: "serafina.l@example.com",
      subject: "Membership Application Inquiry",
      message: "Hello! I am a newly arrived Filipino resident in Yamashina, Kyoto, and would love to join the KCFC choir. Could you kindly let me know if there are audition requirements?",
      status: "unread",
      createdAt: new Date().toISOString()
    },
    {
      name: "Juanito Cruz",
      email: "juanito.c@example.com",
      subject: "Fellowship Food Guidelines",
      message: "Peace be with you. I would like to sponsor a sheet of home-baked cassava cake for next Sunday's fellowship. Whom should I contact in the kitchen committee to log this?",
      status: "unread",
      createdAt: new Date().toISOString()
    }
  ];

  messages.forEach((msg, idx) => {
    const mRef = doc(db, 'messages', `message_${idx + 1}`);
    insertBatch.addSet(mRef, msg);
  });

  await insertBatch.commit();
}

export async function purgeAllDummyData(callerUid: string) {
  const usersSnap = await getDocs(collection(db, 'users'));
  const templatesSnap = await getDocs(collection(db, 'chore_duty_templates'));
  const pollsSnap = await getDocs(collection(db, 'polls'));
  const transSnap = await getDocs(collection(db, 'accounting'));
  const catsSnap = await getDocs(collection(db, 'accounting_categories'));
  const annSnap = await getDocs(collection(db, 'announcements'));
  const msgSnap = await getDocs(collection(db, 'messages'));

  // Fetch responses inside polls
  const responseSnaps: { pollId: string; docs: any[] }[] = [];
  for (const pollDoc of pollsSnap.docs) {
    const respSnap = await getDocs(collection(db, 'polls', pollDoc.id, 'responses'));
    responseSnaps.push({ pollId: pollDoc.id, docs: respSnap.docs });
  }

  const batch = writeBatch(db);

  // Delete only dummy users (uid starts with 'user_' or email ends with '@kcfcjp.com')
  // We keep the current user/caller and other real users who registered (typically they have a generated UID and doesn't start with 'user_')
  usersSnap.docs.forEach((uDoc) => {
    const data = uDoc.data();
    const isDummy = uDoc.id.startsWith('user_') || (data.email && data.email.endsWith('@kcfcjp.com'));
    if (isDummy && uDoc.id !== callerUid) {
      batch.delete(doc(db, 'users', uDoc.id));
    }
  });

  // Delete other seeded collections
  templatesSnap.docs.forEach((d) => batch.delete(doc(db, 'chore_duty_templates', d.id)));
  transSnap.docs.forEach((d) => batch.delete(doc(db, 'accounting', d.id)));
  catsSnap.docs.forEach((d) => batch.delete(doc(db, 'accounting_categories', d.id)));
  annSnap.docs.forEach((d) => batch.delete(doc(db, 'announcements', d.id)));
  msgSnap.docs.forEach((d) => batch.delete(doc(db, 'messages', d.id)));

  for (const rSnap of responseSnaps) {
    rSnap.docs.forEach((d) => {
      batch.delete(doc(db, 'polls', rSnap.pollId, 'responses', d.id));
    });
  }
  pollsSnap.docs.forEach((d) => batch.delete(doc(db, 'polls', d.id)));

  await batch.commit();
}
