import fs from 'node:fs';

const path = 'src/components/admin/BroadcastTool.tsx';
let source = fs.readFileSync(path, 'utf8');

const replacements = [
  ["bg-purple-50 dark:bg-purple-950/10 border-purple-200 dark:border-purple-950/40 text-purple-900 dark:text-purple-200", "bg-[#EAF3FF] dark:bg-blue-500/10 border-blue-200 dark:border-blue-400/20 text-[#123B66] dark:text-blue-200"],
  ["hover:bg-purple-100", "hover:bg-blue-100"],
  ["bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md hover:bg-indigo-100", "bg-[#EAF3FF] dark:bg-blue-500/10 text-[#2563EB] dark:text-blue-300 px-2 py-0.5 rounded-md hover:bg-blue-100"],
  ["focus-within:ring-1 focus-within:ring-purple-500", "focus-within:ring-1 focus-within:ring-blue-500"],
  ["dark:hover:bg-[#252520]/80", "dark:hover:bg-slate-700"],
  ["dark:hover:bg-[#252520]", "dark:hover:bg-slate-800"],
];
for (const [from, to] of replacements) source = source.split(from).join(to);

// Make personalization and formatting controls practical touch targets.
source = source.replaceAll('className="text-[9px] bg-[#EAF3FF]', 'className="min-h-11 text-[10px] bg-[#EAF3FF]');
source = source.replaceAll('className="p-1 px-2 rounded-lg hover:bg-gray-200', 'className="min-h-11 min-w-11 p-2 rounded-lg hover:bg-gray-200');
source = source.replace('"p-1 px-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400 flex items-center gap-1 text-[11px] font-bold cursor-pointer",', '"min-h-11 px-3 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400 flex items-center gap-1 text-[11px] font-bold cursor-pointer",');
source = source.replace('className="p-1 text-center hover:bg-gray-150 dark:hover:bg-slate-800 rounded-lg text-lg transition-transform hover:scale-115 cursor-pointer"', 'className="min-h-11 min-w-11 p-2 text-center hover:bg-gray-150 dark:hover:bg-slate-800 rounded-lg text-lg transition-transform hover:scale-110 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"');

// Ensure the primary action is not accidentally interpreted as form submit if nested later.
source = source.replace('<button\n            onClick={handleSend}', '<button\n            type="button"\n            onClick={handleSend}');

// Improve toggle focus treatment and touch height.
source = source.replaceAll('"p-4 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer",', '"min-h-16 p-4 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",');

// Selected-member remove control should itself meet the mobile target guideline.
source = source.replace('className="p-0.5 hover:bg-white/20 rounded-full transition-colors cursor-pointer"', 'className="min-h-11 min-w-11 inline-flex items-center justify-center hover:bg-white/20 rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"');

fs.writeFileSync(path, source);
console.log('Staged broadcast composer accessibility and palette polish.');
