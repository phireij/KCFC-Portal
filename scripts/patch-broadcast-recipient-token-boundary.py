from pathlib import Path

path = Path('server.ts')
source = path.read_text()

old_announcement_destructure = 'const { title, body, recipientTokens } = req.body;'
new_announcement_destructure = 'const { title, body } = req.body;'
if source.count(old_announcement_destructure) != 1:
    raise SystemExit('Expected one announcement recipientTokens destructure')
source = source.replace(old_announcement_destructure, new_announcement_destructure, 1)

old_announcement_block = '''      if (Array.isArray(recipientTokens) && recipientTokens.length > 0) {
        logMessage(`[FCM BROADCAST] Using ${recipientTokens.length} client-provided tokens for announcement push.`);
        allTokens.push(...recipientTokens.filter(tk => typeof tk === "string" && tk.trim() !== ""));
        targetedUsersCount = recipientTokens.length;
      } else {
        logMessage(`[FCM BROADCAST] Fetching tokens from Firestore with REST fallback for announcement push.`);
        const allUsers = await fetchAllUsersWithFallback(token);
        allUsers.forEach(u => {
          if (u.preferences?.announcements === false) return; // Opted out of announcement updates

          const tokens = u.fcmTokens || [];
          if (Array.isArray(tokens) && tokens.length > 0) {
            allTokens.push(...tokens.filter(tk => typeof tk === "string" && tk.trim() !== ""));
            targetedUsersCount++;
          }
        });
      }'''
new_announcement_block = '''      logMessage(`[FCM BROADCAST] Fetching tokens from Firestore with REST fallback for announcement push.`);
      const allUsers = await fetchAllUsersWithFallback(token);
      allUsers.forEach(u => {
        if (u.preferences?.announcements === false) return; // Opted out of announcement updates

        const tokens = u.fcmTokens || [];
        const validTokens = tokens.filter(isDeliverableFcmToken);
        if (validTokens.length > 0) {
          allTokens.push(...validTokens);
          targetedUsersCount++;
        }
      });'''
if old_announcement_block not in source:
    raise SystemExit('Expected announcement client-token override block not found')
source = source.replace(old_announcement_block, new_announcement_block, 1)

old_custom_destructure = 'const { userIds, title, body, clickAction, recipientTokens, notificationIdsByUser } = req.body;'
new_custom_destructure = 'const { userIds, title, body, clickAction, notificationIdsByUser } = req.body;'
if source.count(old_custom_destructure) != 1:
    raise SystemExit('Expected one custom recipientTokens destructure')
source = source.replace(old_custom_destructure, new_custom_destructure, 1)

old_custom_block = '''      if (Array.isArray(recipientTokens) && recipientTokens.length > 0) {
        logMessage(`[FCM CUSTOM] Using ${recipientTokens.length} client-provided tokens for custom push.`);
        allTokens.push(...recipientTokens.filter(tk => typeof tk === "string" && tk.trim() !== ""));
      } else {
        logMessage(`[FCM CUSTOM] Fetching tokens from Firestore with REST fallback for custom push.`);
        targetUsers.forEach(u => {
          if (u.preferences?.broadcasts === false) return; // Opted out of broadcasts

          const tokens = u.fcmTokens || [];
          if (Array.isArray(tokens) && tokens.length > 0) {
            allTokens.push(...tokens.filter(tk => typeof tk === "string" && tk.trim() !== ""));
          }
        });
      }'''
new_custom_block = '''      logMessage(`[FCM CUSTOM] Fetching tokens from Firestore with REST fallback for custom push.`);
      targetUsers.forEach(u => {
        if (u.preferences?.broadcasts === false) return; // Opted out of broadcasts

        const tokens = u.fcmTokens || [];
        allTokens.push(...tokens.filter(isDeliverableFcmToken));
      });'''
if old_custom_block not in source:
    raise SystemExit('Expected custom client-token override block not found')
source = source.replace(old_custom_block, new_custom_block, 1)

if 'recipientTokens' in source:
    raise SystemExit('recipientTokens remains in server.ts after boundary patch')

path.write_text(source)
