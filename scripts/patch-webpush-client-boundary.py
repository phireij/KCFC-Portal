from pathlib import Path

path = Path('src/lib/fcmClient.ts')
source = path.read_text()

old = '''    if (!regResponse.ok) {
      const errText = await regResponse.text();
      const isPermissionDenied = regResponse.status === 403 || /PERMISSION_DENIED|permission/i.test(errText);
      if (isPermissionDenied) {
        console.warn("WebPush: Backend registration lacked permission. Falling back to direct Firestore self-update.", errText);
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
          webPushSubscriptions: arrayUnion(subscriptionJson),
          updatedAt: new Date().toISOString()
        });
        console.log("WebPush: Successfully registered PushSubscription directly in Firestore.");
        return true;
      }
      throw new Error(`Backend registration failed: ${errText}`);
    }
'''
new = '''    if (!regResponse.ok) {
      throw new Error(`Backend Web Push registration failed with status ${regResponse.status}.`);
    }
'''

if old not in source:
    raise SystemExit('Web Push direct Firestore fallback block not found')
source = source.replace(old, new, 1)
path.write_text(source)
