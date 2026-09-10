import fs from 'node:fs';

const path = 'src/components/admin/BroadcastTool.tsx';
let source = fs.readFileSync(path, 'utf8');

const replacements = [
  ["<section className=\"bg-white dark:bg-[#1e1e1a] rounded-[40px] p-8 md:p-10 shadow-sm border border-gray-100 dark:border-white/5\">", "<section className=\"kcfc-surface overflow-hidden p-4 sm:p-6 lg:p-8\">"],
  ["<div className=\"w-12 h-12 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center\">", "<div className=\"flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200\">"],
  ["<h2 className=\"text-2xl font-serif text-[#1a1a1a] dark:text-[#f5f5f0]\">Broadcast System</h2>", "<h2 className=\"text-[22px] font-extrabold tracking-tight text-[#172033] dark:text-white\">Broadcast System</h2>"],
  ["<p className=\"text-gray-500 dark:text-gray-400 font-serif italic text-sm\">Every broadcast keeps a durable KCFC Inbox copy; PWA and email are secondary alerts.</p>", "<p className=\"mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400\">Every broadcast keeps a durable KCFC Inbox copy; PWA and email are secondary alerts.</p>"],
  ["bg-[#5A5A40] border-[#5A5A40]", "bg-[#123B66] border-[#123B66]"],
  ["bg-[#5A5A40] text-white", "bg-[#123B66] text-white"],
  ["text-[#8a8a65] dark:text-[#8a8a65]", "text-[#64748B] dark:text-slate-400"],
  ["border-[#5A5A40]/10", "border-[#123B66]/10"],
  ["bg-purple-600 border-purple-600", "bg-[#2563EB] border-[#2563EB]"],
  ["bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400", "bg-[#EAF3FF] dark:bg-blue-500/10 text-[#2563EB] dark:text-blue-300"],
  ["bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400", "bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200"],
  ["focus:ring-purple-500", "focus:ring-blue-500"],
  ["bg-purple-500", "bg-[#2563EB]"],
  ["bg-purple-600 text-white shadow-purple-600/20 hover:bg-purple-700", "bg-[#123B66] text-white shadow-blue-900/20 hover:bg-[#0f3156]"],
  ["dark:bg-[#1e1e1a]", "dark:bg-slate-900"],
  ["dark:bg-[#11110f]/20", "dark:bg-slate-950/30"],
  ["dark:bg-[#252520]", "dark:bg-slate-800"],
  ["dark:bg-[#1a1a16]", "dark:bg-slate-950"],
  ["dark:hover:bg-[#2c2c26]", "dark:hover:bg-slate-800"],
  ["dark:bg-[#1c1c18]", "dark:bg-slate-900"],
  ["dark:text-[#f5f5f0]", "dark:text-white"],
];

for (const [from, to] of replacements) source = source.split(from).join(to);

// Increase frequently used filter controls to accessible mobile touch height.
source = source.replaceAll('px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer', 'min-h-11 px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer');
source = source.replaceAll('px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer', 'min-h-11 px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer');
source = source.replaceAll('px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all border cursor-pointer', 'min-h-11 px-3 py-2 rounded-xl text-[11px] font-bold transition-all border cursor-pointer');

// Improve semantic toggle state on the two delivery-channel buttons.
const channelButtonAnchor = '<button\n              onClick={() => setSendInPortal(!sendInPortal)}';
if (source.includes(channelButtonAnchor)) {
  source = source.replace(channelButtonAnchor, '<button\n              type="button"\n              aria-pressed={sendInPortal}\n              onClick={() => setSendInPortal(!sendInPortal)}');
}
const emailButtonAnchor = '<button\n              onClick={() => setSendByEmail(!sendByEmail)}';
if (source.includes(emailButtonAnchor)) {
  source = source.replace(emailButtonAnchor, '<button\n              type="button"\n              aria-pressed={sendByEmail}\n              onClick={() => setSendByEmail(!sendByEmail)}');
}

// Search and selected-member removal need accessible names.
source = source.replace('placeholder="Search member by name or email..."\n                    value={individualSearch}', 'aria-label="Search members by name or email"\n                    placeholder="Search member by name or email..."\n                    value={individualSearch}');
source = source.replace('type="button" \n                            onClick={() => setSelectedIndividualIds', 'type="button"\n                            aria-label={`Remove ${u.displayName || u.email || \'member\'} from selection`}\n                            onClick={() => setSelectedIndividualIds');

// Make member search results keyboard-accessible without changing selection logic.
source = source.replace(
  '<div \n                            key={u.uid}\n                            onClick={() => {',
  '<button\n                            type="button"\n                            key={u.uid}\n                            aria-pressed={isSelected}\n                            onClick={() => {'
);
source = source.replace(
  'className={cn(\n                              "p-2.5 text-xs flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5",',
  'className={cn(\n                              "min-h-11 w-full p-2.5 text-left text-xs flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",'
);
source = source.replace('                          </div>\n                        );\n                      })}', '                          </button>\n                        );\n                      })}');

// Modernize leadership email visual identity to the approved KCFC palette.
source = source.replaceAll('#fcfcf9', '#F7F9FC');
source = source.replaceAll('#e5e5df', '#DDE5EE');
source = source.replaceAll('#5A5A40', '#123B66');
source = source.replaceAll('#4A4A30', '#172033');
source = source.replaceAll('#2d2d25', '#172033');
source = source.replaceAll('#8a8a80', '#64748B');

// Update channel labels to reflect the actual routing model.
source = source.replace('>In-Portal Alert</div>', '>PWA / Portal Alert</div>');
source = source.replace('Pushes an instant notification notice inside the portal dashboard.', 'Sends the member a PWA alert while the KCFC Inbox remains the durable copy.');
source = source.replace('>Direct E-mail Broadcast</div>', '>Email Partner Alert</div>');
source = source.replace("Sends directly to recipients' Google/Registered email accounts.", "Sends to eligible members' registered email while retaining the KCFC Inbox copy.");

fs.writeFileSync(path, source);
console.log('Staged KCFC navy/royal mobile-first leadership broadcast composer refresh.');
