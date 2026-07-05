import { readFileSync } from "fs";
import path from "path";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = JSON.parse(
  readFileSync(path.resolve(process.cwd(), "firebase-applet-config.json"), "utf-8")
);

const app = initializeApp(firebaseConfig);
const dbId = firebaseConfig.firestoreDatabaseId;

const db = dbId ? getFirestore(app, dbId) : getFirestore(app);

async function run() {
  try {
    console.log("Starting web SDK query on dbId:", dbId || "(default)");
    const querySnapshot = await getDocs(collection(db, "users"));
    console.log(`TOTAL DOCUMENTS IN 'users' COLLECTION: ${querySnapshot.size}`);
    querySnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`- Doc ID: ${doc.id}`);
      console.log(`  email: ${data.email}`);
      console.log(`  displayName: ${data.displayName}`);
      console.log(`  isVerified: ${data.isVerified}`);
      console.log(`  isCoreMember: ${data.isCoreMember}`);
      console.log(`  fcmTokens:`, data.fcmTokens);
      console.log(`  preferences:`, data.preferences);
    });
  } catch (err: any) {
    console.error("Web query failed:", err.message);
  }
}

run();
