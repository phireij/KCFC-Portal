from pathlib import Path

server = Path('server.ts')
s = server.read_text()
s = s.replace('''    const token = authHeader.split("Bearer ")[1];\n    const { targetToken } = req.body;\n\n    try {\n''', '''    const token = authHeader.split("Bearer ")[1];\n\n    try {\n''', 1)
s = s.replace('''      // 3. Gather active tokens\n      const allTokens: string[] = [];\n      if (typeof targetToken === "string" && targetToken.trim() !== "") {\n        allTokens.push(targetToken.trim());\n      }\n      \n      const savedTokens = callerProfile.fcmTokens || [];\n''', '''      // 3. Gather active tokens only from the authenticated caller profile.\n      const allTokens: string[] = [];\n      const savedTokens = callerProfile.fcmTokens || [];\n''', 1)
server.write_text(s)

verifier = Path('scripts/verify-self-test-push-boundary.ts')
v = verifier.read_text()
v = v.replace("assert.doesNotMatch(route, /const\\s*\\{[^}]*\\b(?:target|targetUid|userId|uid|recipient)\\b[^}]*\\}\\s*=\\s*req\\.body/, 'Self-test push must not destructure a caller-selected recipient.');\n", "assert.doesNotMatch(route, /const\\s*\\{[^}]*\\b(?:target|targetUid|targetToken|userId|uid|recipient)\\b[^}]*\\}\\s*=\\s*req\\.body/, 'Self-test push must not destructure a caller-selected recipient or push token.');\nassert.doesNotMatch(route, /\\btargetToken\\b/, 'Self-test push must never accept a caller-supplied push token.');\nassert.match(route, /const savedTokens = callerProfile\\.fcmTokens \\|\\| \\[\\]/, 'Self-test FCM tokens must come from the authenticated caller profile.');\n")
verifier.write_text(v)
