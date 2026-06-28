import { readFileSync } from "fs";
import path from "path";

const firebaseConfig = JSON.parse(
  readFileSync(path.resolve(process.cwd(), "firebase-applet-config.json"), "utf-8")
);

async function run() {
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId || "(default)"}/documents/messages?key=${firebaseConfig.apiKey}`;
  
  try {
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      const docs = data.documents || [];
      console.log(`Found ${docs.length} documents in messages collection via REST API.`);
      docs.forEach((doc: any) => {
        const fields = doc.fields || {};
        console.log(`- Document path: ${doc.name}`);
        console.log(`  Fields:`, JSON.stringify(fields, null, 2));
      });
    } else {
      console.error("REST Fetch failed:", await response.text());
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

run();
