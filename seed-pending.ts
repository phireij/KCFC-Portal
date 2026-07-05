import { readFileSync } from "fs";
import path from "path";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const firebaseConfigFromFile = JSON.parse(
  readFileSync(path.resolve(process.cwd(), "firebase-applet-config.json"), "utf-8")
);

const appAdmin = getApps().find(app => app.name === "admin-app") || initializeApp({
  projectId: firebaseConfigFromFile.projectId,
}, "admin-app");

const dbAdmin = firebaseConfigFromFile.firestoreDatabaseId
  ? getFirestore(appAdmin, firebaseConfigFromFile.firestoreDatabaseId)
  : getFirestore(appAdmin);

async function run() {
  const targetEmails = ["kaizen.webmktg@gmail.com", "philbalgotr@gmail.com"];
  console.log("Starting script to set status to 'membership pending' for target emails:", targetEmails);

  for (const email of targetEmails) {
    const emailTrimmed = email.trim();
    const emailLower = emailTrimmed.toLowerCase();
    
    // Check if user exists (checking exact and lowercase)
    let userQuerySnap = await dbAdmin.collection("users").where("email", "==", emailTrimmed).get();
    if (userQuerySnap.empty) {
      userQuerySnap = await dbAdmin.collection("users").where("email", "==", emailLower).get();
    }

    if (!userQuerySnap.empty) {
      // User document(s) exist, update them to Pending (isVerified = false)
      for (const doc of userQuerySnap.docs) {
        console.log(`User document found for ${emailTrimmed} with ID: ${doc.id}. Updating status to Pending...`);
        await doc.ref.update({
          isVerified: false,
          roles: ["member"],
          isDisabled: false,
          updatedAt: FieldValue.serverTimestamp()
        });
        console.log(`[SUCCESS] Updated ${doc.id} to membership pending.`);
      }
    } else {
      // User document does not exist, let's create a new one!
      const partBeforeAt = emailTrimmed.split("@")[0];
      const displayName = partBeforeAt.charAt(0).toUpperCase() + partBeforeAt.slice(1);
      const generatedUid = `pending_${partBeforeAt.replace(/[^a-zA-Z0-9]/g, "_")}`;

      console.log(`No document found for ${emailTrimmed}. Creating new Pending user document with UID: ${generatedUid}`);
      
      const newProfile = {
        uid: generatedUid,
        email: emailLower,
        displayName: displayName,
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=5A5A40&color=fff`,
        roles: ["member"],
        ministries: [],
        isEmailVerified: true,
        isVerified: false,
        isDisabled: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      await dbAdmin.collection("users").doc(generatedUid).set(newProfile);
      console.log(`[SUCCESS] Created new document for ${emailTrimmed} with membership pending status.`);
    }
  }
  
  console.log("Status seeding/updating script finished successfully.");
}

run().catch((err) => {
  console.error("Error running script:", err);
  process.exit(1);
});
