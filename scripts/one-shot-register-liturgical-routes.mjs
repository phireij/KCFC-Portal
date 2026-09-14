import fs from 'node:fs';

const path = 'server.ts';
const source = fs.readFileSync(path, 'utf8');

const importAnchor = 'import { buildPwaDeliveryEvidence, type PwaTransportAttempt } from "./src/lib/pwaDeliveryEvidence";';
const importLine = 'import { registerLiturgicalCommunicationRoutes } from "./server/liturgicalCommunicationRoutes";';
const middlewareAnchor = '  app.use(express.json());\n  app.use(express.urlencoded({ extended: true }));';
const registration = '  app.use(express.json());\n  app.use(express.urlencoded({ extended: true }));\n\n  // Trusted recipient resolution stays server-side; browser callers provide only poll identity.\n  registerLiturgicalCommunicationRoutes(app, { auth: authAdmin, db: dbAdmin });';

if (source.includes(importLine) || source.includes('registerLiturgicalCommunicationRoutes(app')) {
  throw new Error('Refusing one-shot patch: liturgical route registration already appears in server.ts.');
}
if (source.split(importAnchor).length !== 2) {
  throw new Error('Refusing one-shot patch: expected exactly one server import anchor.');
}
if (source.split(middlewareAnchor).length !== 2) {
  throw new Error('Refusing one-shot patch: expected exactly one Express middleware anchor.');
}

const next = source
  .replace(importAnchor, `${importAnchor}\n${importLine}`)
  .replace(middlewareAnchor, registration);

if (!next.includes(importLine) || !next.includes('registerLiturgicalCommunicationRoutes(app, { auth: authAdmin, db: dbAdmin });')) {
  throw new Error('One-shot patch verification failed.');
}
if ((next.match(/registerLiturgicalCommunicationRoutes/g) || []).length !== 2) {
  throw new Error('One-shot patch produced an unexpected registration count.');
}

fs.writeFileSync(path, next, 'utf8');
console.log('server.ts liturgical route registration patch: PASS');
