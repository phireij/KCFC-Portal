from pathlib import Path

path = Path('server.ts')
source = path.read_text()
old_announcement = '''        logMsgText = `[FCM SIMULATION] (No registered real browser push tokens found). Announcement broadcast simulation completed:\\n  Title: "${title}"\\n  Body preview: "${body.substring(0, 100)}..."`;'''
new_announcement = '''        logMsgText = `[FCM SIMULATION] No registered real browser push tokens found. Announcement broadcast simulation completed without message-content logging.`;'''
old_custom = '''        logMsgText = `[FCM SIMULATION] (No registered real browser push tokens found for targeted users). Custom broadcast simulation completed:\\n  Title: "${title}"\\n  Body preview: "${body.substring(0, 100)}..."`;'''
new_custom = '''        logMsgText = `[FCM SIMULATION] No registered real browser push tokens found for targeted users. Custom broadcast simulation completed without message-content logging.`;'''
if source.count(old_announcement) != 1:
    raise SystemExit('Expected announcement simulation content log not found exactly once')
if source.count(old_custom) != 1:
    raise SystemExit('Expected custom simulation content log not found exactly once')
source = source.replace(old_announcement, new_announcement, 1)
source = source.replace(old_custom, new_custom, 1)
if 'Body preview: "${body.substring(0, 100)}..."' in source:
    raise SystemExit('Broadcast body preview logging remains after patch')
path.write_text(source)
