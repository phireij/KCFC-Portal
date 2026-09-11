from pathlib import Path

p = Path('server.ts')
s = p.read_text()

old_public = '''      let emailSent = false;\n      if (smtpHost && smtpUser && smtpPass) {\n        logMessage(`[INBOUND CONTACT] Initiating background SMTP mail dispatch to kcfc.jp@gmail.com...`);\n'''
new_public = '''      let emailSent = false;\n      const allowInquiryEmailDelivery = runtimeEnvironment !== "staging";\n      if (allowInquiryEmailDelivery && smtpHost && smtpUser && smtpPass) {\n        logMessage(`[INBOUND CONTACT] Initiating background SMTP mail dispatch to kcfc.jp@gmail.com...`);\n'''
if old_public not in s:
    raise SystemExit('public inquiry SMTP marker missing')
s = s.replace(old_public, new_public, 1)

old_public_else = '''      } else {\n        logMessage(`[INBOUND CONTACT] SMTP disabled or credentials missing. Skipping email notification.`);\n      }\n\n      // 2. Write the message to Firestore'''
new_public_else = '''      } else if (!allowInquiryEmailDelivery) {\n        logMessage(`[INBOUND CONTACT] Staging runtime: SMTP notification suppressed; inquiry remains in isolated staging data.`);\n      } else {\n        logMessage(`[INBOUND CONTACT] SMTP disabled or credentials missing. Skipping email notification.`);\n      }\n\n      // 2. Write the message to Firestore'''
if old_public_else not in s:
    raise SystemExit('public inquiry SMTP else marker missing')
s = s.replace(old_public_else, new_public_else, 1)

admin_anchor = '''      if (!hasPermission) {\n        res.status(403).json({ error: "Forbidden: Only Admin or President can trigger email alerts" });\n        return;\n      }\n\n      // 3. Send email notification via SMTP\n'''
admin_new = '''      if (!hasPermission) {\n        res.status(403).json({ error: "Forbidden: Only Admin or President can trigger email alerts" });\n        return;\n      }\n\n      if (runtimeEnvironment === "staging") {\n        logMessage(`[SMTP SIMULATION] Staging runtime: inquiry email alert suppressed for message ${messageId}.`);\n        res.json({\n          success: true,\n          simulated: true,\n          message: "Staging runtime: inquiry email alert simulated; no SMTP message was sent."\n        });\n        return;\n      }\n\n      // 3. Send email notification via SMTP\n'''
if admin_anchor not in s:
    raise SystemExit('admin inquiry email guard anchor missing')
s = s.replace(admin_anchor, admin_new, 1)

p.write_text(s)
