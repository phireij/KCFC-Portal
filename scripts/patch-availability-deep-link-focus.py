from pathlib import Path

p = Path('src/pages/Polls.tsx')
s = p.read_text()

old = "  const [searchParams] = useSearchParams();\n  const [mode, setMode] = useState<PageMode>('availability');"
new = "  const [searchParams] = useSearchParams();\n  const focusedPollId = searchParams.get('id');\n  const [mode, setMode] = useState<PageMode>('availability');"
assert s.count(old) == 1, f'focused poll state anchor count={s.count(old)}'
s = s.replace(old, new)

old_effect = """  useEffect(() => {
    const targetId = searchParams.get('id');
    if (!targetId || polls.length === 0) return;
    const target = polls.find((poll) => poll.id === targetId);
    if (!target) return;
    if (target.category === 'core_member') {
      setMode('legacy');
      return;
    }
    if (canLead && searchParams.get('leader') === '1') {
      setMode('leader');
      setExpandedLeaderPoll(targetId);
      return;
    }
    setMode('availability');
    setTimeout(() => {
      document.getElementById(`availability-${targetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }, [polls, searchParams, canLead]);"""
new_effect = """  const focusPollTarget = (prefix: 'availability' | 'leader-availability', targetId: string) => {
    window.setTimeout(() => {
      const target = document.getElementById(`${prefix}-${targetId}`);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.focus({ preventScroll: true });
    }, 150);
  };

  useEffect(() => {
    const targetId = searchParams.get('id');
    if (!targetId || polls.length === 0) return;
    const target = polls.find((poll) => poll.id === targetId);
    if (!target) return;
    if (target.category === 'core_member') {
      setMode('legacy');
      return;
    }
    if (canLead && searchParams.get('leader') === '1') {
      setMode('leader');
      setExpandedLeaderPoll(targetId);
      focusPollTarget('leader-availability', targetId);
      return;
    }
    setMode('availability');
    focusPollTarget('availability', targetId);
  }, [polls, searchParams, canLead]);"""
assert s.count(old_effect) == 1, f'deep-link effect block count={s.count(old_effect)}'
s = s.replace(old_effect, new_effect)

old_card_call = "<AvailabilityCard key={poll.id} poll={poll} response={myResponses[poll.id]} selected={draftSelections[poll.id] || []} saving={savingPollId === poll.id} saved={savedPollId === poll.id} onToggle={(date) => toggleMassSelection(poll.id, date)} onSave={(selected) => saveAvailability(poll, selected)} />"
new_card_call = "<AvailabilityCard key={poll.id} poll={poll} focused={focusedPollId === poll.id} response={myResponses[poll.id]} selected={draftSelections[poll.id] || []} saving={savingPollId === poll.id} saved={savedPollId === poll.id} onToggle={(date) => toggleMassSelection(poll.id, date)} onSave={(selected) => saveAvailability(poll, selected)} />"
assert s.count(old_card_call) == 1, f'AvailabilityCard call count={s.count(old_card_call)}'
s = s.replace(old_card_call, new_card_call)

old_leader_article = '<article key={poll.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">'
new_leader_article = "<article key={poll.id} id={`leader-availability-${poll.id}`} tabIndex={focusedPollId === poll.id ? -1 : undefined} aria-current={focusedPollId === poll.id ? 'true' : undefined} className={cn('overflow-hidden rounded-2xl border bg-white transition-colors dark:bg-white/[0.03]', focusedPollId === poll.id ? 'border-blue-300 ring-2 ring-blue-300/60 dark:border-blue-400/40 dark:ring-blue-400/30' : 'border-slate-200 dark:border-white/10')}>"
assert s.count(old_leader_article) == 1, f'leader article marker count={s.count(old_leader_article)}'
s = s.replace(old_leader_article, new_leader_article)

old_sig = "function AvailabilityCard({ poll, response, selected, saving, saved, onToggle, onSave }: { poll: Poll; response?: PollResponse; selected: string[]; saving: boolean; saved: boolean; onToggle: (date: string) => void; onSave: (selected: string[]) => void }) {"
new_sig = "function AvailabilityCard({ poll, focused, response, selected, saving, saved, onToggle, onSave }: { poll: Poll; focused: boolean; response?: PollResponse; selected: string[]; saving: boolean; saved: boolean; onToggle: (date: string) => void; onSave: (selected: string[]) => void }) {"
assert s.count(old_sig) == 1, f'AvailabilityCard signature count={s.count(old_sig)}'
s = s.replace(old_sig, new_sig)

old_article = "<article id={`availability-${poll.id}`} className={cn('overflow-hidden rounded-[22px] border bg-white dark:bg-white/[0.03]', response ? 'border-green-200 dark:border-green-400/20' : 'border-blue-200 dark:border-blue-400/20')}>"
new_article = "<article id={`availability-${poll.id}`} tabIndex={focused ? -1 : undefined} aria-current={focused ? 'true' : undefined} className={cn('overflow-hidden rounded-[22px] border bg-white transition-colors dark:bg-white/[0.03]', focused ? 'border-blue-300 ring-2 ring-blue-300/60 dark:border-blue-400/40 dark:ring-blue-400/30' : response ? 'border-green-200 dark:border-green-400/20' : 'border-blue-200 dark:border-blue-400/20')}>"
assert s.count(old_article) == 1, f'AvailabilityCard article marker count={s.count(old_article)}'
s = s.replace(old_article, new_article)

p.write_text(s)
