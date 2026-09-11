from pathlib import Path

path = Path('server.ts')
text = path.read_text()

replacements = [
    (
        '  const upload = multer();',
        '  const publicContactUpload = multer({\n    limits: {\n      fields: 32,\n      fieldSize: 16 * 1024,\n    },\n  });'
    ),
    (
        '  app.post("/api/public/contact", upload.any(), async (req, res) => {',
        '  app.post("/api/public/contact", publicContactUpload.none(), async (req, res) => {'
    ),
]
for old, new in replacements:
    if old not in text:
        raise SystemExit(f'missing marker: {old}')
    text = text.replace(old, new, 1)

old_validation = '''    if (!name || !email || !message) {
      logMessage(`[INBOUND CONTACT ERROR] Validation failed. Missing name, email, or message.`);
      res.status(400).json({ 
        error: "Missing required fields: name, email, and message are required.",
        extracted: { name, email, subject, message }
      });
      return;
    }
'''
new_validation = '''    const validEmail = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
    const hasHeaderBreaks = /[\\r\\n]/.test(name) || /[\\r\\n]/.test(email) || /[\\r\\n]/.test(subject);
    const fieldsWithinBounds = name.length <= 160 && email.length <= 320 && subject.length <= 200 && message.length <= 5000;

    if (!name || !email || !message || !validEmail || hasHeaderBreaks || !fieldsWithinBounds) {
      logMessage(`[INBOUND CONTACT ERROR] Validation failed for public inquiry payload.`);
      res.status(400).json({
        error: "Invalid contact inquiry. Please check the submitted fields and try again."
      });
      return;
    }
'''
if old_validation not in text:
    raise SystemExit('missing validation block')
text = text.replace(old_validation, new_validation, 1)

smtp_anchor = '''      const smtpFrom = process.env.SMTP_FROM || smtpUser || '\"KCFC Community Portal\" <no-reply@kcfc-portal.org>';

      const mailOptions = {
'''
smtp_replacement = '''      const smtpFrom = process.env.SMTP_FROM || smtpUser || '\"KCFC Community Portal\" <no-reply@kcfc-portal.org>';
      const escapeHtml = (value: string) => value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
      const safeName = escapeHtml(name);
      const safeEmail = escapeHtml(email);
      const safeSubject = escapeHtml(subject || "KCFC Portal Inquiry");
      const safeMessage = escapeHtml(message).replace(/\\n/g, "<br />");

      const mailOptions = {
'''
if smtp_anchor not in text:
    raise SystemExit('missing smtp anchor')
text = text.replace(smtp_anchor, smtp_replacement, 1)

mail_replacements = [
    ('subject: `[KCFC Web Inquiry] New message from ${name}`', 'subject: `[KCFC Web Inquiry] New message from ${name}`'),
    ('>${name}</td>', '>${safeName}</td>'),
    ('href="mailto:${email}" style="color: #8a8a65;">${email}</a>', 'href="mailto:${safeEmail}" style="color: #8a8a65;">${safeEmail}</a>'),
    ('>${subject || "KCFC Portal Inquiry"}</td>', '>${safeSubject}</td>'),
    ('              "${message}"', '              ${safeMessage}'),
]
for old, new in mail_replacements:
    if old not in text:
        raise SystemExit(f'missing mail marker: {old}')
    text = text.replace(old, new, 1)

alert_count = text.count('          alertSent: true,')
if alert_count < 2:
    raise SystemExit(f'expected at least 2 alertSent true markers, found {alert_count}')
# Only the two public-contact persistence payloads in this region should change.
contact_start = text.index('  app.post("/api/public/contact"')
contact_end = text.index('  // Secure API endpoint for client-side triggered email alerts', contact_start)
contact = text[contact_start:contact_end]
if contact.count('alertSent: true') != 2:
    raise SystemExit(f'expected exactly 2 contact alertSent true markers, found {contact.count("alertSent: true")}')
contact = contact.replace('alertSent: true', 'alertSent: emailSent')
text = text[:contact_start] + contact + text[contact_end:]

path.write_text(text)
