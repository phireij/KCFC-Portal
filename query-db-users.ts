import { readFileSync } from "fs";
import path from "path";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const firebaseConfig = JSON.parse(
  readFileSync(path.resolve(process.cwd(), "firebase-applet-config.json"), "utf-8")
);

const targetProjectId = firebaseConfig.projectId;
const dbId = firebaseConfig.firestoreDatabaseId;

console.log("PROJECT ID:", targetProjectId);
console.log("DATABASE ID:", dbId);

const app = initializeApp({
  projectId: targetProjectId,
}, "query-app");

const db = getFirestore(app, dbId);

async function run() {
  try {
    const snap = await db.collection("users").get();
    console.log(`TOTAL DOCUMENTS IN 'users' COLLECTION: ${snap.size}`);
    snap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`- Doc ID: ${doc.id}`);
      console.log(`  email: ${data.email}`);
      console.log(`  displayName: ${data.displayName}`);
      console.log(`  isVerified: ${data.isVerified}`);
      console.log(`  isCoreMember: ${data.isCoreMember}`);
    });
  } catch (err: any) {
    console.error("Query failed:", err.message);
  }
}

run();
