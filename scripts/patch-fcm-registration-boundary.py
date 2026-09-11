from pathlib import Path

server_path = Path('server.ts')
server = server_path.read_text()
client_path = Path('src/lib/fcmClient.ts')
client = client_path.read_text()

anchor = '''const MAX_WEB_PUSH_SUBSCRIPTIONS_PER_USER = 8;
const MAX_WEB_PUSH_ENDPOINT_LENGTH = 2048;
const MAX_WEB_PUSH_KEY_LENGTH = 512;
'''
replacement = anchor + '''const MAX_FCM_TOKENS_PER_USER = 8;
const MAX_FCM_TOKEN_LENGTH = 4096;
'''
if anchor not in server:
    raise SystemExit('FCM constants anchor not found')
server = server.replace(anchor, replacement, 1)

route_anchor = '''  // Secure API endpoint to delete user credentials from Firebase Authentication and cascade-clean up Firestore records
'''
route = '''  // Caller-bound FCM token registration with bounded recent-device retention.
  app.post("/api/users/register-fcm-token", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: Missing authorization token" });
      return;
    }

    const idToken = authHeader.split("Bearer ")[1];
    const rawToken = req.body?.token;
    const normalizedToken = typeof rawToken === "string" ? rawToken.trim() : "";
    if (!normalizedToken || normalizedToken.length > MAX_FCM_TOKEN_LENGTH || !isDeliverableFcmToken(normalizedToken)) {
      res.status(400).json({ error: "Invalid FCM registration token" });
      return;
    }

    try {
      const decodedToken = await authAdmin.verifyIdToken(idToken);
      const userId = decodedToken.uid;
      const userRef = dbAdmin.collection("users").doc(userId);
      const userDoc = await userRef.get();
      const existingTokens = userDoc.exists && Array.isArray(userDoc.data()?.fcmTokens)
        ? userDoc.data()?.fcmTokens.filter((value: unknown): value is string => isDeliverableFcmToken(value)) || []
        : [];
      const fcmTokens = existingTokens
        .filter((value: string) => value !== normalizedToken)
        .slice(-(MAX_FCM_TOKENS_PER_USER - 1));
      fcmTokens.push(normalizedToken);

      await userRef.set({
        fcmTokens,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      logMessage(`[FCM REGISTER] Successfully registered caller-bound device token for user [redacted]`);
      res.json({ success: true, registeredTokens: fcmTokens.length });
    } catch (error) {
      console.error("[FCM REGISTER ERROR]", error);
      res.status(500).json({ error: "Failed to register FCM device token" });
    }
  });

'''
if route_anchor not in server:
    raise SystemExit('FCM route anchor not found')
server = server.replace(route_anchor, route + route_anchor, 1)

old_import = 'import { doc, updateDoc, arrayUnion } from "firebase/firestore";'
new_import = 'import { doc, updateDoc } from "firebase/firestore";'
if old_import not in client:
    raise SystemExit('FCM client Firestore import not found')
client = client.replace(old_import, new_import, 1)

old_block = '''    if (token) {
      // Cleanly append device token to current user's profile in Firestore using arrayUnion
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(token),
        updatedAt: new Date().toISOString()
      });
      console.log("FCM: Device push token registered successfully.");
      return token;
    } else {
'''
new_block = '''    if (token) {
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== userId) {
        throw new Error("Authenticated user does not match the device-registration target.");
      }
      const idToken = await currentUser.getIdToken();
      const response = await fetch("/api/users/register-fcm-token", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        throw new Error("Failed to register FCM device token with the KCFC server.");
      }
      console.log("FCM: Device push token registered successfully.");
      return token;
    } else {
'''
if old_block not in client:
    raise SystemExit('FCM client persistence block not found')
client = client.replace(old_block, new_block, 1)

server_path.write_text(server)
client_path.write_text(client)
