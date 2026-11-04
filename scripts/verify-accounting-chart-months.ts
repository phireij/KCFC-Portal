import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import ts from 'typescript';

// Execute the actual chart expression without importing React, Firebase or the
// accounting page. Every transaction and clock value below is synthetic.
const source = readFileSync('src/pages/LegacyAccounting.tsx', 'utf8');
const tree = ts.createSourceFile('LegacyAccounting.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const expressions: ts.Expression[] = [];
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'chartData' && node.initializer) {
    expressions.push(node.initializer);
  }
  ts.forEachChild(node, visit);
}
visit(tree);
assert.equal(expressions.length, 1, 'Exactly one actual chartData initializer must exist.');
const chartExpression = ts.transpileModule(`(${expressions[0].getText(tree)})`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
assert.match(source, /<BarChart\s+data=\{chartData\}/, 'The rendered chart must consume the tested expression.');

type Entry = { date: string; type: 'income' | 'expense'; amount: number; status?: string };
type Bucket = { name: string; income: number; expense: number };
function chartAt(reference: Date, transactions: Entry[]): Bucket[] {
  class FixedDate extends Date {
    constructor(value?: string | number | Date) {
      super(value === undefined ? reference.getTime() : value instanceof Date ? value.getTime() : value);
    }
    static now() { return reference.getTime(); }
  }
  return JSON.parse(JSON.stringify(runInNewContext(chartExpression, {
    Date: FixedDate, transactions, format, startOfMonth, endOfMonth, parseISO,
  }, { timeout: 1000 })));
}

const regressions = [
  [2026, 2, 31, ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']],
  [2024, 2, 31, ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']],
  [2026, 4, 31, ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May']],
  [2026, 0, 31, ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan']],
  [2026, 11, 31, ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']],
] as const;
for (const [year, month, day, expected] of regressions) {
  const now = new Date(year, month, day, 23, 59, 59, 999);
  const actual = chartAt(now, []);
  assert.deepEqual(actual.map(bucket => bucket.name), expected, `Consecutive months at ${now.toString()}`);
  assert.ok(actual.every(bucket => bucket.income === 0 && bucket.expense === 0));
}

// Cover every day, not only a few month ends, in a leap and non-leap year.
// Distinct amounts also expose duplicate, missing or wrong-year allocations.
let checkedDays = 0;
for (const year of [2024, 2026]) {
  for (let month = 0; month < 12; month++) {
    const dates = Array.from({ length: 6 }, (_, index) => new Date(year, month - 5 + index, 1));
    const transactions: Entry[] = [];
    const expected = dates.map((date, index) => {
      transactions.push(
        { date: format(date, 'yyyy-MM-dd'), type: 'income', amount: index + 1, status: 'approved' },
        { date: format(endOfMonth(date), 'yyyy-MM-dd'), type: 'expense', amount: (index + 1) * 10, status: 'pending' },
      );
      return { name: format(date, 'MMM'), income: index + 1, expense: (index + 1) * 10 };
    });
    transactions.push(
      { date: format(new Date(year, month - 6, 1), 'yyyy-MM-dd'), type: 'income', amount: 10000 },
      { date: format(new Date(year, month + 1, 1), 'yyyy-MM-dd'), type: 'expense', amount: 20000 },
      { date: format(new Date(year - 1, month, 1), 'yyyy-MM-dd'), type: 'income', amount: 40000 },
      { date: 'not-a-date', type: 'income', amount: 80000 },
    );
    const before = JSON.stringify(transactions);
    const days = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= days; day++) {
      const now = new Date(year, month, day, 23, 59, 59, 999);
      assert.deepEqual(chartAt(now, transactions), expected, `Chart allocation at ${now.toString()}`);
      checkedDays++;
    }
    assert.equal(JSON.stringify(transactions), before, 'Chart calculation must not mutate ledger entries.');
  }
}
console.log(`Accounting chart months: PASS (${checkedDays} day-by-day allocations, 5 explicit regressions; timezone ${Intl.DateTimeFormat().resolvedOptions().timeZone}).`);
