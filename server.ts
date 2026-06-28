import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync, appendFileSync } from "fs";
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getMessaging as getMessagingAdmin } from "firebase-admin/messaging";
import nodemailer from "nodemailer";
import multer from "multer";

const hasImportMeta = typeof import.meta !== "undefined" && "url" in import.meta;
const currentFilename = hasImportMeta ? fileURLToPath(import.meta.url) : (typeof __filename !== "undefined" ? __filename : "");
const currentDirname = hasImportMeta ? path.dirname(currentFilename) : (typeof __dirname !== "undefined" ? __dirname : "");

// Load Firebase configuration
const hasServerEnvConfig = !!(process.env.FIREBASE_API_KEY && process.env.FIREBASE_PROJECT_ID);
const firebaseConfig = hasServerEnvConfig ? {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID,
} : JSON.parse(
  readFileSync(path.resolve(process.cwd(), "firebase-applet-config.json"), "utf-8")
);

// Unified server diagnostic logger
function logMessage(msg: string) {
  const logStr = `\n[${new Date().toISOString()}] ${msg}`;
  console.log(logStr);
  try {
    appendFileSync("./delete-logs.txt", logStr, "utf-8");
  } catch (err) {
    console.error("Failed to write to delete-logs.txt:", err);
  }
}

// Initialize Firebase Admin SDK using a named application instance to ensure it
// strictly connects to the configured workspace Firebase project ID instead of 
// any default tenant Cloud Run environment instance.
const appAdmin = getApps().find(app => app.name === "admin-app") || initializeApp({
  projectId: firebaseConfig.projectId,
}, "admin-app");

// Access Firestore database (supports named databases if configured)
const dbAdmin = firebaseConfig.firestoreDatabaseId
  ? getFirestore(appAdmin, firebaseConfig.firestoreDatabaseId)
  : getFirestore(appAdmin);

const authAdmin = getAuth(appAdmin);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Secure API endpoint to delete user credentials from Firebase Authentication and cascade-clean up Firestore records
  app.post("/api/admin/delete-user", async (req, res) => {
    logMessage(`--- BEGIN OF DELETE USER BY UID REQUEST ---`);
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logMessage(`[WARN] Unauthorized: Missing bearer token header`);
      res.status(401).json({ error: "Unauthorized: Missing authorization token" });
      return;
    }

    const token = authHeader.split("Bearer ")[1];
    const { targetUserId } = req.body;

    if (!targetUserId) {
      logMessage(`[WARN] Bad Request: Missing targetUserId parameter`);
      res.status(400).json({ error: "Missing targetUserId parameter" });
      return;
    }

    try {
      // 1. Verify caller ID token
      logMessage(`[PROCESS] Verifying caller ID token...`);
      const decodedToken = await authAdmin.verifyIdToken(token);
      const callerUid = decodedToken.uid;
      const callerEmail = decodedToken.email;
      logMessage(`[PROCESS] Caller UID verified: "${callerUid}" | Email: "${callerEmail}"`);

      // 2. Verify admin credentials
      let hasPermission = false;
      if (callerEmail === "kcfc.jp@gmail.com") {
        hasPermission = true;
        logMessage(`[PASS] Permission granted directly to Bootstrap Admin: ${callerEmail}`);
      } else {
        logMessage(`[PROCESS] Retrieving caller profile from Firestore room database...`);
        const callerDoc = await dbAdmin.collection("users").doc(callerUid).get();
        if (callerDoc.exists) {
          const callerProfile = callerDoc.data();
          const roles = callerProfile?.roles || [];
          hasPermission = roles.some((r: string) => ["admin", "president"].includes(r));
        }
      }

      if (!hasPermission) {
        logMessage(`[ERROR] Access denied: Caller lacks Admin/President permission`);
        res.status(403).json({ error: "Forbidden: Only Admin or President can remove member credentials and records" });
        return;
      }

      if (callerUid === targetUserId) {
        logMessage(`[ERROR] Attempted self-destruction blocked`);
        res.status(400).json({ error: "Bad Request: You cannot delete your own account credentials" });
        return;
      }

      // 3. Delete user from Firebase Auth (Optional/Non-blocking if Identity Toolkit is disabled)
      logMessage(`[PROCESS] Executing authAdmin.deleteUser("${targetUserId}")...`);
      let authUserDeleted = false;
      try {
        await authAdmin.deleteUser(targetUserId);
        authUserDeleted = true;
        logMessage(`[SUCCESS] Deleted user Auth credentials for UID: ${targetUserId}`);
      } catch (authError: any) {
        logMessage(`[WARN] Skipping Auth credentials purge. Auth user deletion skipped/errored (Identity Toolkit API likely unconfigured or disabled): ${authError.message}`);
      }

      // 4. Delete user profile doc from 'users' collection
      logMessage(`[PROCESS] Attempting to clean up Firestore profile document users/${targetUserId}...`);
      try {
        await dbAdmin.collection("users").doc(targetUserId).delete();
        logMessage(`[SUCCESS] Deleted document from users collection for UID: ${targetUserId}`);
      } catch (e: any) {
        logMessage(`[WARN] Firestore profile cleanup skipped/errored: ${e.message}`);
      }

      // 5. Clean up from all 'polls' assignments and 'responses'
      logMessage(`[PROCESS] Starting cascade cleanup of poll assignments and responses for UID: ${targetUserId}...`);
      try {
        const pollsSnap = await dbAdmin.collection("polls").get();
        for (const pollDoc of pollsSnap.docs) {
          const pollData = pollDoc.data();
          if (pollData.assignments) {
            const updatedAssignments = { ...pollData.assignments };
            let changed = false;
            Object.keys(updatedAssignments).forEach(date => {
              if (updatedAssignments[date] && updatedAssignments[date][targetUserId]) {
                delete updatedAssignments[date][targetUserId];
                changed = true;
              }
            });
            if (changed) {
              await pollDoc.ref.update({
                assignments: updatedAssignments,
                updatedAt: new Date()
              });
              logMessage(`[SUCCESS] Cleaned up assignments in poll ID: ${pollDoc.id}`);
            }
          }

          // Clean up the user's responses subcollection in this poll
          const responsesSnap = await pollDoc.ref.collection("responses").where("userId", "==", targetUserId).get();
          if (!responsesSnap.empty) {
            const batch = dbAdmin.batch();
            responsesSnap.docs.forEach(docSnap => {
              batch.delete(docSnap.ref);
            });
            await batch.commit();
            logMessage(`[SUCCESS] Deleted ${responsesSnap.size} responses for UID: ${targetUserId} in poll: ${pollDoc.id}`);
          }
        }
      } catch (e: any) {
        logMessage(`[WARN] Firestore polls cleanup skipped/errored: ${e.message}`);
      }

      // 6. Delete individual 'duties' documents associated with this user
      logMessage(`[PROCESS] Starting cascade cleanup of duties documents for UID: ${targetUserId}...`);
      try {
        const dutiesSnap = await dbAdmin.collection("duties").where("userId", "==", targetUserId).get();
        if (!dutiesSnap.empty) {
          const batch = dbAdmin.batch();
          dutiesSnap.docs.forEach(docSnap => {
            batch.delete(docSnap.ref);
          });
          await batch.commit();
          logMessage(`[SUCCESS] Deleted ${dutiesSnap.size} duties doc(s) for UID: ${targetUserId}`);
        }
      } catch (e: any) {
        logMessage(`[WARN] Firestore duties cleanup skipped/errored: ${e.message}`);
      }

      logMessage(`--- END OF DELETE USER BY UID REQUEST (SUCCESS) ---`);
      res.json({ 
        success: true, 
        message: `Member and all associated community assignments, duties, and records have been successfully and permanently cleaned up.`,
        details: {
          projectId: firebaseConfig.projectId,
          deletedUid: targetUserId,
          authCredentialsPurged: authUserDeleted
        }
      });
    } catch (error: any) {
      logMessage(`[FATAL ERROR] Root execution failed inside API handler: ${error.message}`);
      console.error("Error deleting member credentials and cascade records:", error);
      res.status(500).json({ error: error.message || "Failed to delete user credentials and clinical records" });
    }
  });

  // Secure API endpoint to delete user credentials from Firebase Authentication by email and cascade-clean up Firestore records
  app.post("/api/admin/delete-user-by-email", async (req, res) => {
    logMessage(`--- BEGIN OF PURGE BY EMAIL REQUEST ---`);
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logMessage(`[WARN] Unauthorized: Missing bearer token header`);
      res.status(401).json({ error: "Unauthorized: Missing authorization token" });
      return;
    }

    const token = authHeader.split("Bearer ")[1];
    const { email } = req.body;

    if (!email) {
      logMessage(`[WARN] Bad Request: Missing target email parameter`);
      res.status(400).json({ error: "Missing email parameter" });
      return;
    }

    const emailTrimmed = email.trim();
    logMessage(`[PROCESS] Requested email deletion: "${emailTrimmed}"`);

    try {
      // 1. Verify caller ID token
      logMessage(`[PROCESS] Verifying caller ID token...`);
      const decodedToken = await authAdmin.verifyIdToken(token);
      const callerUid = decodedToken.uid;
      const callerEmail = decodedToken.email;
      logMessage(`[PROCESS] Caller UID verified: "${callerUid}" | Email: "${callerEmail}"`);

      // 2. Fetch caller's profile from Firestore to verify role
      let hasPermission = false;
      if (callerEmail === "kcfc.jp@gmail.com") {
        hasPermission = true;
        logMessage(`[PASS] Permission granted directly to Bootstrap Admin: ${callerEmail}`);
      } else {
        logMessage(`[PROCESS] Retrieving caller profile from Firestore room database...`);
        const callerDoc = await dbAdmin.collection("users").doc(callerUid).get();
        if (callerDoc.exists) {
          const callerProfile = callerDoc.data();
          const roles = callerProfile?.roles || [];
          hasPermission = roles.some((r: string) => ["admin", "president"].includes(r));
        }
      }

      if (!hasPermission) {
        logMessage(`[ERROR] Access denied: Caller lacks Admin/President permission`);
        res.status(403).json({ error: "Forbidden: Only Admin or President can remove member credentials and records" });
        return;
      }

      // 3. Find the user by email in Firebase Auth (or fallback to Firestore 'users' email match if Auth API is disabled)
      logMessage(`[PROCESS] Finding user by email: "${emailTrimmed}"...`);
      let targetUser: { uid: string; email?: string } | null = null;
      let authUserLookupError: any = null;

      try {
        const authUser = await authAdmin.getUserByEmail(emailTrimmed);
        targetUser = { uid: authUser.uid, email: authUser.email };
        logMessage(`[PROCESS] Found user in Auth DB. UID: "${targetUser.uid}" | Email: "${targetUser.email}"`);
      } catch (authError: any) {
        authUserLookupError = authError;
        logMessage(`[WARN] Firebase Auth search failed for "${emailTrimmed}" (possibly disabled Auth API): ${authError.message}`);
        
        if (authError.code === 'auth/user-not-found') {
          res.status(404).json({ error: `Not Found: No authentication account found for email "${emailTrimmed}"` });
          return;
        }
      }

      // Fallback search in Firestore 'users' collection
      if (!targetUser) {
        logMessage(`[PROCESS] Trying Firestore fallback search for email: "${emailTrimmed}"...`);
        try {
          // A. Try exact email match in Firestore
          let userQuerySnap = await dbAdmin.collection("users").where("email", "==", emailTrimmed).get();
          if (userQuerySnap.empty) {
            // B. Try lowercase email match in Firestore
            userQuerySnap = await dbAdmin.collection("users").where("email", "==", emailTrimmed.toLowerCase()).get();
          }

          if (!userQuerySnap.empty) {
            const firstDoc = userQuerySnap.docs[0];
            targetUser = { uid: firstDoc.id, email: firstDoc.data().email };
            logMessage(`[SUCCESS] Found user UID "${targetUser.uid}" via Firestore 'users' search for: "${emailTrimmed}"`);
          } else {
            // C. Robust full scan fallback for case-insensitive and whitespace-tolerance match
            logMessage(`[PROCESS] Checking full Firestore list of users for email: "${emailTrimmed}"...`);
            const allUsersSnap = await dbAdmin.collection("users").get();
            const matchedDoc = allUsersSnap.docs.find(doc => {
              const uEmail = doc.data().email;
              return uEmail && uEmail.trim().toLowerCase() === emailTrimmed.toLowerCase();
            });

            if (matchedDoc) {
              targetUser = { uid: matchedDoc.id, email: matchedDoc.data().email };
              logMessage(`[SUCCESS] Found user UID "${targetUser.uid}" via Firestore scan search fallback for: "${emailTrimmed}"`);
            } else {
              // No user in Auth and no user in Firestore after all three stages
              logMessage(`[ERROR] User search failed entirely. Not found in Auth and no profile in Firestore match.`);
              const errMsg = authUserLookupError?.message || `No profile or account found matching email "${emailTrimmed}"`;
              res.status(404).json({ error: `Not Found: ${errMsg}` });
              return;
            }
          }
        } catch (fsError: any) {
          logMessage(`[FATAL] Both Auth lookup and Firestore query failed: ${fsError.message}`);
          throw authUserLookupError || fsError;
        }
      }

      if (callerUid === targetUser.uid) {
        logMessage(`[ERROR] Attempted self-destruction blocked`);
        res.status(400).json({ error: "Bad Request: You cannot delete your own account credentials" });
        return;
      }

      // 4. Delete user from Firebase Auth (Optional: skip if fails due to disabled Auth API)
      logMessage(`[PROCESS] Executing authAdmin.deleteUser("${targetUser.uid}")...`);
      let authUserDeleted = false;
      try {
        await authAdmin.deleteUser(targetUser.uid);
        authUserDeleted = true;
        logMessage(`[SUCCESS] User credentials deleted from Firebase Authentication successfully!`);
      } catch (authDeleteError: any) {
        logMessage(`[WARN] Skipping Auth credentials purge. Auth user deletion/cleanup skipped (Identity Toolkit API likely disabled/unconfigured): ${authDeleteError.message}`);
      }

      // 5. Delete from users collection too, in case profile exists but wasn't deleted
      logMessage(`[PROCESS] Attempting to clean up Firestore profile document users/${targetUser.uid}...`);
      try {
        await dbAdmin.collection("users").doc(targetUser.uid).delete();
        logMessage(`[SUCCESS] Document deleted from users collection.`);
      } catch (e: any) {
        logMessage(`[WARN] Firestore profile cleanup skipped/errored: ${e.message}`);
      }

      // 6. Clean up from all 'polls' assignments and 'responses'
      logMessage(`[PROCESS] Starting cascade cleanup of poll assignments and responses for UID: ${targetUser.uid}...`);
      try {
        const pollsSnap = await dbAdmin.collection("polls").get();
        for (const pollDoc of pollsSnap.docs) {
          const pollData = pollDoc.data();
          if (pollData.assignments) {
            const updatedAssignments = { ...pollData.assignments };
            let changed = false;
            Object.keys(updatedAssignments).forEach(date => {
              if (updatedAssignments[date] && updatedAssignments[date][targetUser.uid]) {
                delete updatedAssignments[date][targetUser.uid];
                changed = true;
              }
            });
            if (changed) {
              await pollDoc.ref.update({
                assignments: updatedAssignments,
                updatedAt: new Date()
              });
              logMessage(`[SUCCESS] Cleaned up assignments in poll ID: ${pollDoc.id}`);
            }
          }

          // Clean up the user's responses subcollection in this poll
          const responsesSnap = await pollDoc.ref.collection("responses").where("userId", "==", targetUser.uid).get();
          if (!responsesSnap.empty) {
            const batch = dbAdmin.batch();
            responsesSnap.docs.forEach(docSnap => {
              batch.delete(docSnap.ref);
            });
            await batch.commit();
            logMessage(`[SUCCESS] Deleted ${responsesSnap.size} responses for UID: ${targetUser.uid} in poll: ${pollDoc.id}`);
          }
        }
      } catch (e: any) {
        logMessage(`[WARN] Firestore polls cleanup skipped/errored: ${e.message}`);
      }

      // 7. Delete individual 'duties' documents associated with this user
      logMessage(`[PROCESS] Starting cascade cleanup of duties documents for UID: ${targetUser.uid}...`);
      try {
        const dutiesSnap = await dbAdmin.collection("duties").where("userId", "==", targetUser.uid).get();
        if (!dutiesSnap.empty) {
          const batch = dbAdmin.batch();
          dutiesSnap.docs.forEach(docSnap => {
            batch.delete(docSnap.ref);
          });
          await batch.commit();
          logMessage(`[SUCCESS] Deleted ${dutiesSnap.size} duties doc(s) for UID: ${targetUser.uid}`);
        }
      } catch (e: any) {
        logMessage(`[WARN] Firestore duties cleanup skipped/errored: ${e.message}`);
      }

      logMessage(`--- END OF PURGE BY EMAIL REQUEST (SUCCESS) ---`);
      res.json({ 
        success: true, 
        message: `Member profile and all associated community assignments, duties, and records for ${emailTrimmed} have been successfully and permanently cleaned up.`,
        details: {
          projectId: firebaseConfig.projectId,
          deletedUid: targetUser.uid,
          deletedEmail: targetUser.email || emailTrimmed,
          authCredentialsPurged: authUserDeleted
        }
      });
    } catch (error: any) {
      logMessage(`[FATAL ERROR] Root execution failed inside API handler: ${error.message}`);
      if (error.stack) {
        logMessage(`[STACK] ${error.stack}`);
      }
      res.status(500).json({ error: error.message || "Failed to delete user credentials" });
    }
  });

  // Secure API endpoint to dispatch email broadcasts via SMTP or simulation logging
  app.post("/api/admin/broadcast-email", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: Missing authorization token" });
      return;
    }

    const token = authHeader.split("Bearer ")[1];
    const { emails, title, body } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0 || !title || !body) {
      res.status(400).json({ error: "Missing required parameters (emails array, title, body)" });
      return;
    }

    try {
      // 1. Verify caller ID token
      const decodedToken = await authAdmin.verifyIdToken(token);
      const callerUid = decodedToken.uid;

      // 2. Fetch caller's profile from Firestore to verify role
      const callerDoc = await dbAdmin.collection("users").doc(callerUid).get();
      if (!callerDoc.exists) {
        res.status(403).json({ error: "Forbidden: Caller profile not found" });
        return;
      }

      const callerProfile = callerDoc.data();
      const roles = callerProfile?.roles || [];
      const hasPermission = roles.some((r: string) => ["admin", "president", "secretary", "pro"].includes(r));

      if (!hasPermission) {
        res.status(403).json({ error: "Forbidden: You do not have permission to send broadcasts" });
        return;
      }

      // 3. Configure Transporter
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = parseInt(process.env.SMTP_PORT || "587");
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASSWORD;
      const smtpFrom = process.env.SMTP_FROM || smtpUser || '"KCFC Community Portal" <no-reply@kcfc-portal.org>';

      let emailLogMessage = ``;
      let usingRealSMTP = false;

      if (smtpHost && smtpUser && smtpPass) {
        usingRealSMTP = true;
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass
          }
        });

        logMessage(`[BROADCAST EMAIL] Dispatching real SMTP mail to ${emails.length} recipients...`);
        await transporter.sendMail({
          from: smtpFrom,
          bcc: emails.join(","),
          subject: title,
          text: body.replace(/<[^>]*>/g, ""),
          html: `
            <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background-color: #fcfcf9; border: 1px solid #e5e5df; border-radius: 12px;">
              <h2 style="color: #4A4A30; border-bottom: 2px solid #5A5A40; padding-bottom: 10px; margin-top: 0;">${title}</h2>
              <div style="font-size: 14px; line-height: 1.6; color: #2d2d25; white-space: pre-wrap;">${body}</div>
              <hr style="border: 0; border-top: 1px solid #e5e5df; margin: 20px 0;" />
              <p style="font-size: 11px; color: #8a8a80; font-style: italic; margin-bottom: 0;">
                This broadcast email was dispatched to you on behalf of the KCFC community. If you do not want to receive these broadcasts, you can update your notification preferences in My Profile.
              </p>
            </div>
          `
        });
        emailLogMessage = `[SMTP SUCCESS] real SMTP mail successfully dispatched via ${smtpHost} to recipients.`;
        logMessage(emailLogMessage);
      } else {
        emailLogMessage = `[SMTP SIMULATION] (No SMTP credentials configured in env) Simulated sending of custom mail broadcast:\n  Subject: "${title}"\n  Recipients Count: ${emails.length} [${emails.join(", ")}]\n  Content Preview: ${body.substring(0, 300)}...`;
        logMessage(emailLogMessage);
      }

      res.json({ 
        success: true, 
        message: usingRealSMTP ? "Broadcast emails dispatched successfully via SMTP." : "Broadcast simulated successfully (SMTP not configured). Logs have been written.",
        recipientsSentCount: emails.length,
        usingSMTP: usingRealSMTP,
        details: emailLogMessage
      });

    } catch (error: any) {
      console.error("Error sending email broadcast:", error);
      res.status(500).json({ error: error.message || "Failed to dispatch email broadcast" });
    }
  });

  // Secure API endpoint to dispatch Firebase Cloud Messaging push broadcasts to members
  app.post("/api/admin/broadcast-announcement-push", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: Missing authorization token" });
      return;
    }

    const token = authHeader.split("Bearer ")[1];
    const { title, body } = req.body;

    if (!title || !body) {
      res.status(400).json({ error: "Missing required parameters (title, body)" });
      return;
    }

    try {
      // 1. Verify caller ID token
      const decodedToken = await authAdmin.verifyIdToken(token);
      const callerUid = decodedToken.uid;

      // 2. Fetch caller's profile from Firestore to verify role
      const callerDoc = await dbAdmin.collection("users").doc(callerUid).get();
      if (!callerDoc.exists) {
        res.status(403).json({ error: "Forbidden: Caller profile not found" });
        return;
      }

      const callerProfile = callerDoc.data();
      const roles = callerProfile?.roles || [];
      const hasPermission = roles.some((r: string) => ["admin", "president", "vice_president", "secretary", "pro"].includes(r)) || callerUid === "admin-app" || callerProfile?.email === 'kcfc.jp@gmail.com';

      if (!hasPermission) {
        res.status(403).json({ error: "Forbidden: You do not have permission to send push notifications" });
        return;
      }

      // 3. Find all users who have registered fcmTokens and whose preferences allow announcements
      const usersSnap = await dbAdmin.collection("users").get();
      const allTokens: string[] = [];
      let targetedUsersCount = 0;

      usersSnap.forEach(userDoc => {
        const u = userDoc.data();
        if (u.preferences?.announcements === false) return; // Opted out of announcement updates

        const tokens = u.fcmTokens || [];
        if (Array.isArray(tokens) && tokens.length > 0) {
          allTokens.push(...tokens.filter(tk => typeof tk === "string" && tk.trim() !== ""));
          targetedUsersCount++;
        }
      });

      // De-duplicate tokens
      const uniqueTokens = Array.from(new Set(allTokens));

      let logMsgText = "";
      let successCount = 0;
      let failureCount = 0;

      if (uniqueTokens.length > 0) {
        // Send actual push notification via Admin SDK
        const messagingAdmin = getMessagingAdmin(appAdmin);
        logMessage(`[FCM BROADCAST] Sending announcement push notification to ${uniqueTokens.length} active device tokens...`);

        const fcmResponse = await messagingAdmin.sendEachForMulticast({
          tokens: uniqueTokens,
          notification: {
            title: title,
            body: body.length > 150 ? body.substring(0, 147) + "..." : body,
          },
          webpush: {
            notification: {
              icon: "/favicon.ico",
              clickAction: "/announcements",
            }
          }
        });

        successCount = fcmResponse.successCount;
        failureCount = fcmResponse.failureCount;

        logMsgText = `[FCM SUCCESS] Broadcasted to ${uniqueTokens.length} tokens. Success: ${successCount}, Failures: ${failureCount}`;
        logMessage(logMsgText);
      } else {
        logMsgText = `[FCM SIMULATION] (No registered browser push tokens found). Announcement broadcast simulation completed:\n  Title: "${title}"\n  Body preview: "${body.substring(0, 100)}..."`;
        logMessage(logMsgText);
      }

      res.json({
        success: true,
        message: uniqueTokens.length > 0 ? "FCM broadcast executed." : "FCM simulated successfully (no devices subscribed yet).",
        totalTokens: uniqueTokens.length,
        successCount,
        failureCount,
        details: logMsgText
      });

    } catch (error: any) {
      console.error("Error sending FCM push broadcast:", error);
      res.status(500).json({ error: error.message || "Failed to dispatch push notification" });
    }
  });

  // Secure API endpoint to dispatch Firebase user verification emails using the backend SMTP transporter
  app.post("/api/auth/send-verification", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: Missing authorization token" });
      return;
    }

    const token = authHeader.split("Bearer ")[1];
    const { displayName } = req.body;

    try {
      // 1. Verify caller ID token to bind email address to their authentic Firebase session
      const decodedToken = await authAdmin.verifyIdToken(token);
      const email = decodedToken.email;

      if (!email) {
        res.status(400).json({ error: "No email associated with token" });
        return;
      }

      // 2. Configure SMTP Transporter
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = parseInt(process.env.SMTP_PORT || "587");
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASSWORD;
      const smtpFrom = process.env.SMTP_FROM || smtpUser || '"KCFC Community Portal" <no-reply@kcfc-portal.org>';

      // Calculate redirect URL to bring verified user back to the application
      const origin = req.headers.origin || "https://ais-pre-6rv5zychth5b7c2qnzvzho-451919823595.asia-northeast1.run.app";
      
      // 3. Generate secure Firebase email verification link
      const actionCodeSettings = {
        url: `${origin}/`,
        handleCodeInApp: false
      };
      
      const verificationLink = await authAdmin.generateEmailVerificationLink(email.trim(), actionCodeSettings);

      let emailSent = false;
      let logMsgText = "";

      if (smtpHost && smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass
          }
        });

        const nameLabel = displayName ? displayName.trim() : email.split('@')[0];

        await transporter.sendMail({
          from: smtpFrom,
          to: email.trim(),
          subject: "Verify Your Email - KCFC Portal",
          text: `Hello ${nameLabel},\n\nThank you for signing up for the Koiwa Church Filipino Community Portal!\n\nPlease verify your email by clicking the link below:\n\n${verificationLink}\n\nThis verification link will expire shortly. If you did not sign up for this account, please ignore this email.`,
          html: `
            <div style="font-family: sans-serif; padding: 30px; max-width: 600px; margin: 0 auto; background-color: #fafaf7; border: 1px solid #e2e2da; border-radius: 20px;">
              <div style="text-align: center; margin-bottom: 25px;">
                <h2 style="color: #5A5A40; border-bottom: 2px solid #5A5A40; display: inline-block; padding-bottom: 8px; margin: 0;">KCFC Portal</h2>
              </div>
              <p style="font-size: 15px; color: #1a1a1a; margin-top: 0;">Hello <strong>${nameLabel}</strong>,</p>
              <p style="font-size: 14px; line-height: 1.6; color: #444;">
                Thank you for registering an account with the <strong>Koiwa Church Filipino Community (KCFC) Portal</strong>. To complete your sign-up and ensure account security, please verify your email address.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationLink}" style="background-color: #5A5A40; color: white; padding: 12px 30px; text-decoration: none; font-size: 14px; font-weight: bold; border-radius: 12px; display: inline-block;">
                  Verify My Email Address
                </a>
              </div>
              <p style="font-size: 12px; color: #666; line-height: 1.5;">
                If the button above doesn't work, you can copy and paste this link into your browser:
                <br />
                <a href="${verificationLink}" style="color: #8a8a65; word-break: break-all;">${verificationLink}</a>
              </p>
              <hr style="border: 0; border-top: 1px solid #e2e2da; margin: 25px 0;" />
              <p style="font-size: 11px; color: #999; font-style: italic; margin-bottom: 0; text-align: center;">
                This registration email was generated dynamically on your request. If you did not initiate this registration, please safely ignore this message.
              </p>
            </div>
          `
        });
        emailSent = true;
        logMsgText = `[SMTP SUCCESS] Sent custom server-side verification link to ${email}`;
        logMessage(logMsgText);
      } else {
        logMsgText = `[SMTP SIMULATION] No server SMTP config found. Raw verification link: ${verificationLink}`;
        logMessage(logMsgText);
      }

      res.json({
        success: true,
        sent: emailSent,
        message: emailSent ? "Verification email dispatched via server SMTP." : "Verification link generated (SMTP credentials missing on server).",
        verificationLink: emailSent ? undefined : verificationLink,
        details: logMsgText
      });
    } catch (error: any) {
      console.error("Error generating verification link or sending email:", error);
      res.status(500).json({ error: error.message || "Failed to process verification email dispatch" });
    }
  });

  // Secure API endpoint to retrieve diagnostic service logs
  app.get("/api/admin/read-delete-logs", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: Missing authorization token" });
      return;
    }

    const token = authHeader.split("Bearer ")[1];
    try {
      // 1. Verify caller ID token
      const decodedToken = await authAdmin.verifyIdToken(token);
      const callerUid = decodedToken.uid;

      // 2. Fetch caller's profile from Firestore to verify role
      const callerDoc = await dbAdmin.collection("users").doc(callerUid).get();
      if (!callerDoc.exists) {
        res.status(403).json({ error: "Forbidden: Coordinator profile not found" });
        return;
      }

      const callerProfile = callerDoc.data();
      const roles = callerProfile?.roles || [];
      const hasPermission = roles.some((r: string) => ["admin", "president"].includes(r));

      if (!hasPermission) {
        res.status(403).json({ error: "Forbidden: Only Admin or President can view diagnostics" });
        return;
      }

      let logs = "No diagnostic logs found yet. Try performing an Auth Purge to populate logs.";
      try {
        logs = readFileSync("./delete-logs.txt", "utf-8");
      } catch (e) {}

      res.json({ success: true, logs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const upload = multer();

  // Public endpoint to receive contact messages from external website (KCFC.COM)
  app.options("/api/public/contact", (req, res) => {
    const requestedHeaders = req.headers["access-control-request-headers"];
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    if (requestedHeaders) {
      res.setHeader("Access-Control-Allow-Headers", requestedHeaders);
    } else {
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With, Accept, Authorization");
    }
    res.sendStatus(204);
  });

  app.post("/api/public/contact", upload.any(), async (req, res) => {
    const requestedHeaders = req.headers["access-control-request-headers"] || req.headers["Access-Control-Request-Headers"];
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    if (requestedHeaders) {
      res.setHeader("Access-Control-Allow-Headers", String(requestedHeaders));
    } else {
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With, Accept, Authorization");
    }

    // Unified server-side diagnostic logging of incoming public inquiries
    const inboundHeaders = JSON.stringify(req.headers);
    const inboundBody = JSON.stringify(req.body);
    const inboundQuery = JSON.stringify(req.query);
    logMessage(`[INBOUND CONTACT] Received request. Headers: ${inboundHeaders} | Body: ${inboundBody} | Query: ${inboundQuery}`);

    const body = req.body || {};
    const query = req.query || {};

    // Ultra-robust, self-healing parameter extraction mapping all possible form shapes
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const stringValues: { key: string; value: string; parentKey?: string }[] = [];

    function traverse(obj: any, parentKey?: string) {
      if (!obj) return;
      if (typeof obj === "object") {
        for (const [k, v] of Object.entries(obj)) {
          if (typeof v === "string" || typeof v === "number") {
            stringValues.push({ key: k, value: String(v), parentKey });
          } else if (v && typeof v === "object") {
            traverse(v, k);
          }
        }
      }
    }

    traverse({ ...body, ...query });

    // 1. Extract Email
    let email = "";
    const emailField = stringValues.find(item => {
      const k = item.key.toLowerCase().replace(/[-_]/g, "");
      return k.includes("email") || k.includes("mail");
    });
    if (emailField) {
      email = emailField.value.trim();
    } else {
      const fallbackEmail = stringValues.find(item => emailRegex.test(item.value));
      if (fallbackEmail) {
        email = fallbackEmail.value.trim();
      }
    }

    // 2. Extract Name
    let name = "";
    const nameField = stringValues.find(item => {
      const k = item.key.toLowerCase().replace(/[-_]/g, "");
      return k.includes("name") && !k.includes("email") && !k.includes("message") && !k.includes("subject") && !k.includes("filename");
    });
    if (nameField) {
      name = nameField.value.trim();
    } else {
      const firstNameField = stringValues.find(item => {
        const k = item.key.toLowerCase().replace(/[-_]/g, "");
        return k.includes("first") || k.includes("fname") || k.includes("given");
      });
      const lastNameField = stringValues.find(item => {
        const k = item.key.toLowerCase().replace(/[-_]/g, "");
        return k.includes("last") || k.includes("lname") || k.includes("family") || k.includes("sur");
      });
      if (firstNameField || lastNameField) {
        name = `${firstNameField?.value || ""} ${lastNameField?.value || ""}`.trim();
      }
    }

    // 3. Extract Message
    let message = "";
    const messageKeys = ["message", "comments", "comment", "body", "contactmessage", "description", "content", "inquiry", "text", "yourmessage", "msg", "textarea"];
    const messageField = stringValues.find(item => {
      const k = item.key.toLowerCase().replace(/[-_]/g, "");
      return messageKeys.some(mk => k === mk || k.includes(mk)) && !k.includes("email") && !k.includes("subject") && !k.includes("name");
    });
    if (messageField) {
      message = messageField.value.trim();
    } else {
      const candidates = stringValues.filter(item => {
        const k = item.key.toLowerCase().replace(/[-_]/g, "");
        const val = item.value.trim();
        return !k.includes("email") && !k.includes("mail") && !k.includes("name") && !k.includes("subject") && !emailRegex.test(val) && val.length > 3;
      });
      if (candidates.length > 0) {
        candidates.sort((a, b) => b.value.length - a.value.length);
        message = candidates[0].value.trim();
      }
    }

    // Fallback: If name is still empty, find any remaining non-empty string that is NOT email or message
    if (!name) {
      const remainingField = stringValues.find(item => {
        const k = item.key.toLowerCase().replace(/[-_]/g, "");
        const val = item.value.trim();
        return val !== email && val !== message && !k.includes("subject") && !k.includes("email") && !k.includes("mail") && !emailRegex.test(val) && val.length > 1;
      });
      if (remainingField) {
        name = remainingField.value.trim();
      }
    }

    // 4. Extract Subject
    let subject = "";
    const subjectField = stringValues.find(item => {
      const k = item.key.toLowerCase().replace(/[-_]/g, "");
      return k.includes("subject") || k.includes("title");
    });
    if (subjectField) {
      subject = subjectField.value.trim();
    }

    logMessage(`[INBOUND CONTACT] Extracted fields => name: "${name}", email: "${email}", subject: "${subject}", message: "${message.substring(0, 100)}..."`);

    if (!name || !email || !message) {
      logMessage(`[INBOUND CONTACT ERROR] Validation failed. Missing name, email, or message.`);
      res.status(400).json({ 
        error: "Missing required fields: name, email, and message are required.",
        extracted: { name, email, subject, message }
      });
      return;
    }

    try {
      // 1. Send the email notification directly using SMTP/Nodemailer
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = parseInt(process.env.SMTP_PORT || "587");
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASSWORD;
      const smtpFrom = process.env.SMTP_FROM || smtpUser || '"KCFC Community Portal" <no-reply@kcfc-portal.org>';

      const mailOptions = {
        from: smtpFrom,
        to: "kcfc.jp@gmail.com",
        subject: `[KCFC Web Inquiry] New message from ${name}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background-color: #fcfcf9; border: 1px solid #e5e5df; border-radius: 12px;">
            <h2 style="color: #4A4A30; border-bottom: 2px solid #5A5A40; padding-bottom: 10px; margin-top: 0;">New Contact Form Message</h2>
            <p style="font-size: 14px; color: #2d2d25;">A new inquiry has been submitted via the KCFC website:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #5A5A40; width: 100px;">From:</td>
                <td style="padding: 8px 0; color: #2d2d25;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #5A5A40;">Email:</td>
                <td style="padding: 8px 0; color: #2d2d25;"><a href="mailto:${email}" style="color: #8a8a65;">${email}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #5A5A40;">Subject:</td>
                <td style="padding: 8px 0; color: #2d2d25;">${subject || "KCFC Portal Inquiry"}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #5A5A40;">Submitted:</td>
                <td style="padding: 8px 0; color: #2d2d25;">${new Date().toUTCString()}</td>
              </tr>
            </table>
            <div style="background-color: #fafaf7; border-left: 4px solid #5A5A40; padding: 15px; border-radius: 4px; font-style: italic; font-size: 14px; line-height: 1.6; color: #333; margin-top: 10px;">
              "${message}"
            </div>
            <hr style="border: 0; border-top: 1px solid #e5e5df; margin: 25px 0;" />
            <div style="text-align: center;">
              <a href="${process.env.APP_URL || "https://portal.kcfcjp.com"}/admin#messages-inbox-section" style="background-color: #5A5A40; color: white; padding: 10px 24px; text-decoration: none; font-size: 12px; font-weight: bold; border-radius: 8px; display: inline-block;">
                Open Executive Inbox
              </a>
            </div>
          </div>
        `
      };

      let emailSent = false;
      if (smtpHost && smtpUser && smtpPass) {
        logMessage(`[INBOUND CONTACT] Attempting SMTP mail dispatch to kcfc.jp@gmail.com...`);
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });
        await transporter.sendMail(mailOptions);
        emailSent = true;
        logMessage(`[INBOUND CONTACT] SMTP mail dispatch SUCCESS.`);
      } else {
        logMessage(`[INBOUND CONTACT] SMTP disabled or credentials missing. Skipping email notification.`);
      }

      // 2. Write the message to Firestore (try direct admin SDK write first, fallback to REST API)
      let firestoreWritten = false;
      let errorDetails = "";
      try {
        logMessage(`[INBOUND CONTACT] Attempting direct Firestore write via dbAdmin...`);
        await dbAdmin.collection("messages").add({
          name,
          email,
          subject: subject || "KCFC Portal Inquiry",
          message,
          status: "unread",
          alertSent: true,
          createdAt: new Date().toISOString()
        });
        firestoreWritten = true;
        logMessage("[SUCCESS] Message written to Firestore via dbAdmin.");
      } catch (dbErr: any) {
        logMessage(`[WARN] dbAdmin direct write failed, attempting unauthenticated REST API fallback. Error: ${dbErr.message}`);
        errorDetails += `[dbAdmin Error: ${dbErr.message}]`;
        
        try {
          const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId || "(default)"}/documents/messages?key=${firebaseConfig.apiKey}`;
          const payload = {
            fields: {
              name: { stringValue: name },
              email: { stringValue: email },
              subject: { stringValue: subject || "KCFC Portal Inquiry" },
              message: { stringValue: message },
              status: { stringValue: "unread" },
              alertSent: { booleanValue: true },
              createdAt: { stringValue: new Date().toISOString() }
            }
          };

          logMessage(`[INBOUND CONTACT] POSTing to REST endpoint: ${firestoreUrl}`);
          const fsResponse = await fetch(firestoreUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          
          if (fsResponse.ok) {
            firestoreWritten = true;
            logMessage("[SUCCESS] Message written to Firestore via REST API fallback.");
          } else {
            const errText = await fsResponse.text();
            logMessage(`[ERROR] REST API fallback failed: ${errText}`);
            errorDetails += ` [REST Error: ${errText}]`;
          }
        } catch (fsErr: any) {
          logMessage(`[ERROR] REST API fetch failed: ${fsErr.message}`);
          errorDetails += ` [REST Fetch Error: ${fsErr.message}]`;
        }
      }

      res.json({ success: true, emailSent, firestoreWritten, errorDetails: errorDetails || undefined });
    } catch (err: any) {
      logMessage(`[ERROR] Public contact endpoint execution failed: ${err.message}`);
      res.status(500).json({ error: err.message || "Failed to process contact inquiry" });
    }
  });

  // Secure API endpoint for client-side triggered email alerts when a new unread message is received
  app.post("/api/admin/send-message-alert", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: Missing authorization token" });
      return;
    }

    const { messageId, name, email, message, createdAt, subject } = req.body;
    if (!messageId || !name || !email || !message) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const token = authHeader.split("Bearer ")[1];
    try {
      // 1. Verify caller ID token
      const decodedToken = await authAdmin.verifyIdToken(token);
      const callerEmail = decodedToken.email;

      // 2. Escape hatch check for direct permission
      let hasPermission = false;
      if (callerEmail === "kcfc.jp@gmail.com") {
        hasPermission = true;
      } else {
        // Fetch caller's profile to verify roles
        try {
          const callerDoc = await dbAdmin.collection("users").doc(decodedToken.uid).get();
          if (callerDoc.exists) {
            const callerProfile = callerDoc.data();
            const roles = callerProfile?.roles || [];
            hasPermission = roles.some((r: string) => ["admin", "president"].includes(r));
          }
        } catch (dbErr) {
          // If Firestore read gets permission denied, fall back to denying except for bootstrap admin
          console.warn("[WARN] DB query failed in send-message-alert:", dbErr);
        }
      }

      if (!hasPermission) {
        res.status(403).json({ error: "Forbidden: Only Admin or President can trigger email alerts" });
        return;
      }

      // 3. Send email notification via SMTP
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = parseInt(process.env.SMTP_PORT || "587");
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASSWORD;
      const smtpFrom = process.env.SMTP_FROM || smtpUser || '"KCFC Community Portal" <no-reply@kcfc-portal.org>';

      if (!smtpHost || !smtpUser || !smtpPass) {
        res.status(503).json({ error: "SMTP mail server is not configured in environment" });
        return;
      }

      const mailOptions = {
        from: smtpFrom,
        to: "kcfc.jp@gmail.com",
        subject: `[KCFC Web Inquiry] New message from ${name}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background-color: #fcfcf9; border: 1px solid #e5e5df; border-radius: 12px;">
            <h2 style="color: #4A4A30; border-bottom: 2px solid #5A5A40; padding-bottom: 10px; margin-top: 0;">New Contact Form Message</h2>
            <p style="font-size: 14px; color: #2d2d25;">A new inquiry has been submitted via the KCFC website:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #5A5A40; width: 100px;">From:</td>
                <td style="padding: 8px 0; color: #2d2d25;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #5A5A40;">Email:</td>
                <td style="padding: 8px 0; color: #2d2d25;"><a href="mailto:${email}" style="color: #8a8a65;">${email}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #5A5A40;">Subject:</td>
                <td style="padding: 8px 0; color: #2d2d25;">${subject || "KCFC Portal Inquiry"}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #5A5A40;">Submitted:</td>
                <td style="padding: 8px 0; color: #2d2d25;">${createdAt || new Date().toUTCString()}</td>
              </tr>
            </table>
            <div style="background-color: #fafaf7; border-left: 4px solid #5A5A40; padding: 15px; border-radius: 4px; font-style: italic; font-size: 14px; line-height: 1.6; color: #333; margin-top: 10px;">
              "${message}"
            </div>
            <hr style="border: 0; border-top: 1px solid #e5e5df; margin: 25px 0;" />
            <div style="text-align: center;">
              <a href="${process.env.APP_URL || "https://portal.kcfcjp.com"}/admin#messages-inbox-section" style="background-color: #5A5A40; color: white; padding: 10px 24px; text-decoration: none; font-size: 12px; font-weight: bold; border-radius: 8px; display: inline-block;">
                Open Executive Inbox
              </a>
            </div>
          </div>
        `
      };

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: "Email alert dispatched successfully" });
    } catch (err: any) {
      console.error("[ERROR] Dispatching email alert:", err);
      res.status(500).json({ error: err.message || "Failed to dispatch email alert" });
    }
  });

  // Example of automation endpoint
  // This could be called by an external cron or just a manual trigger
  app.post("/api/automation/weekly-poll", (req, res) => {
    // In a real scenario, check if it's Thursday and create poll
    res.json({ message: "Automation check performed" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
