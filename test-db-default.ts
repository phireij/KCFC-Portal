import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

async function run() {
  try {
    console.log("Trying default initializeApp (no arguments)...");
    const app = initializeApp();
    const db = getFirestore(app);
    const snap = await db.collection("users").get();
    console.log(`Default initialization SUCCESS. Users count: ${snap.size}`);
  } catch (err: any) {
    console.error("Default initialization FAILED:", err.message);
  }

  try {
    console.log("\nTrying initializeApp with process.env.GOOGLE_CLOUD_PROJECT...");
    console.log("GOOGLE_CLOUD_PROJECT:", process.env.GOOGLE_CLOUD_PROJECT);
  } catch (err: any) {
    console.error("Error checking env:", err);
  }
}

run();
