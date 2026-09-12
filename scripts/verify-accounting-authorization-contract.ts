import fs from 'node:fs';

const accountingShell = fs.readFileSync('src/pages/Accounting.tsx', 'utf8');
const legacyAccounting = fs.readFileSync('src/pages/LegacyAccounting.tsx', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');

const requireMarker = (source: string, marker: string, label: string) => {
  if (!source.includes(marker)) {
    throw new Error(`Missing ${label}: ${marker}`);
  }
};

// Existing UI intent: VP and Auditor may view; Treasurer edits; Auditor approves.
requireMarker(
  accountingShell,
  "const accessRoles = ['admin', 'president', 'treasurer', 'vice_president', 'auditor'];",
  'Accounting shell read-access role contract',
);
requireMarker(
  legacyAccounting,
  "['admin', 'president', 'treasurer', 'vice_president', 'auditor'].includes(r)",
  'Legacy Accounting read-access role contract',
);
requireMarker(
  legacyAccounting,
  "['admin', 'president', 'treasurer'].includes(r)",
  'Legacy Accounting editor role contract',
);
requireMarker(
  legacyAccounting,
  "['admin', 'president', 'auditor'].includes(r)",
  'Legacy Accounting approver role contract',
);

// Firestore must implement the same matrix with separate capabilities.
for (const marker of [
  'function canReadAccounting()',
  'function canEditAccounting()',
  'function canApproveAccounting()',
  'function isEditorUpdate()',
  'function isApprovalUpdate()',
  'allow read: if canReadAccounting();',
  "incoming().get('processedBy', '') == request.auth.uid",
  'allow update: if isEditorUpdate() || isApprovalUpdate();',
  'allow delete: if canEditAccounting();',
  'function canEditAccountingCategories()',
  'allow write: if canEditAccountingCategories();',
]) {
  requireMarker(rules, marker, 'Firestore treasury authorization marker');
}

// Reader roles.
const readBlock = rules.slice(rules.indexOf('function canReadAccounting()'), rules.indexOf('function canEditAccounting()'));
for (const role of ['admin', 'president', 'vice_president', 'treasurer', 'auditor']) {
  requireMarker(readBlock, `'${role}' in roles`, `Accounting reader role ${role}`);
}
for (const forbidden of ['secretary', 'pro', 'spiritual_director']) {
  if (readBlock.includes(`'${forbidden}' in roles`)) {
    throw new Error(`Accounting read access unexpectedly includes ${forbidden}`);
  }
}

// Editor roles.
const editBlock = rules.slice(rules.indexOf('function canEditAccounting()'), rules.indexOf('function canApproveAccounting()'));
for (const role of ['admin', 'president', 'treasurer']) {
  requireMarker(editBlock, `'${role}' in roles`, `Accounting editor role ${role}`);
}
for (const forbidden of ['vice_president', 'auditor', 'secretary', 'pro', 'spiritual_director']) {
  if (editBlock.includes(`'${forbidden}' in roles`)) {
    throw new Error(`Accounting edit access unexpectedly includes ${forbidden}`);
  }
}

// Approver roles.
const approveBlock = rules.slice(rules.indexOf('function canApproveAccounting()'), rules.indexOf('function hasValidAccountingShape'));
for (const role of ['admin', 'president', 'auditor']) {
  requireMarker(approveBlock, `'${role}' in roles`, `Accounting approver role ${role}`);
}
for (const forbidden of ['vice_president', 'treasurer', 'secretary', 'pro', 'spiritual_director']) {
  if (approveBlock.includes(`'${forbidden}' in roles`)) {
    throw new Error(`Accounting approval access unexpectedly includes ${forbidden}`);
  }
}

// Approval must be field-limited and attributable to the signed-in approver.
for (const marker of [
  "incoming().get('status', '') == 'approved'",
  "incoming().get('approvedBy', '') == request.auth.uid",
  "'status', 'approvedBy', 'approvedByName', 'updatedAt'",
]) {
  requireMarker(rules, marker, 'Accounting approval mutation boundary');
}

// Category mutation must follow the editor role set, not the broader global isAdmin helper.
const categoryBlock = rules.slice(rules.indexOf('function canEditAccountingCategories()'), rules.indexOf('// --- Messages Collection ---'));
for (const role of ['admin', 'president', 'treasurer']) {
  requireMarker(categoryBlock, `'${role}' in roles`, `Accounting category editor role ${role}`);
}
for (const forbidden of ['vice_president', 'auditor', 'secretary', 'pro', 'spiritual_director']) {
  if (categoryBlock.includes(`'${forbidden}' in roles`)) {
    throw new Error(`Accounting category write access unexpectedly includes ${forbidden}`);
  }
}

console.log('Accounting UI/Firestore authorization contract: PASS');
