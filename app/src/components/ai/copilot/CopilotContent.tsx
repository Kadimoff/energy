import { ArrowUp, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AiBadge } from '@/components/ai/AiBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { CopilotContext } from '@/services/CopilotService';
import { copilotService } from '@/services/LocalCopilotService';
import { useCopilotData } from '@/stores/coreViews';
import { useUiStore } from '@/stores/ui';
import { useCopilotChat } from './chatStore';
import { ReferenceCard } from './ReferenceCard';

/** Thinking animation length (spec 6.4: at most 1.5 s). */
export const THINK_MS = 700;

let nextId = 1;

function Thinking() {
  const { t } = useT('copilot');
  return (
    <div className="flex items-center gap-2 text-13 text-ink-3" role="status">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-violet-500 motion-safe:animate-pulse-dot"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
      {t('ui.thinking')}
    </div>
  );
}

function Chips({
  items,
  onAsk,
  disabled,
}: {
  items: string[];
  onAsk: (q: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((q) => (
        <button
          key={q}
          type="button"
          disabled={disabled}
          onClick={() => onAsk(q)}
          className="rounded-full border border-violet-200 bg-surface px-3 py-1.5 text-left text-13 text-violet-800 transition-colors duration-180 hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50"
        >
          {q}
        </button>
      ))}
    </div>
  );
}

/** AI Copilot chat (spec 7.13): presets, keyword intents, answers with reference cards. */
export default function CopilotContent({ initialPrompt }: { initialPrompt?: string | null }) {
  const { t, lang } = useT('copilot');
  const data = useCopilotData();
  const setPrompt = useUiStore((s) => s.setCopilotOpen);
  const messages = useCopilotChat((s) => s.messages);
  const add = useCopilotChat((s) => s.add);
  const clearChat = useCopilotChat((s) => s.clear);
  const [pending, setPending] = useState<{ id: number; question: string } | null>(null);
  const [input, setInput] = useState('');
  const [handled, setHandled] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const shownRef = useRef(0);
  const presets = copilotService.presets(lang);

  const ask = (q: string) => {
    const question = q.trim();
    if (!question || pending || !data) return;
    setPending({ id: nextId++, question });
    setInput('');
  };

  // a question passed from another page (e.g. "Copilot-dan soruş") is asked once
  if (initialPrompt && initialPrompt !== handled && data && !pending) {
    setHandled(initialPrompt);
    ask(initialPrompt);
  } else if (!initialPrompt && handled) {
    setHandled(null);
  }

  useEffect(() => {
    if (!pending || !data) return;
    if (shownRef.current !== pending.id) {
      shownRef.current = pending.id;
      add({ id: pending.id, role: 'user', text: pending.question });
    }
    let alive = true;
    const ctx: CopilotContext = { lang, ...data };
    const wait = new Promise((r) => window.setTimeout(r, THINK_MS));
    void Promise.all([copilotService.ask(pending.question, ctx), wait]).then(([answer]) => {
      if (!alive) return;
      add({ id: nextId++, role: 'ai', answer });
      setPending(null);
      if (initialPrompt) setPrompt(true, null);
    });
    return () => {
      alive = false;
    };
  }, [pending, data, lang, initialPrompt, setPrompt, add]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  const lastAi = [...messages].reverse().find((m) => m.role === 'ai');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6"
        aria-live="polite"
      >
        {!data ? (
          <div className="space-y-3" aria-busy="true">
            <span className="sr-only">{t('ui.loadingData')}</span>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-9 w-full rounded-full" />
            <Skeleton className="h-9 w-4/5 rounded-full" />
          </div>
        ) : messages.length === 0 ? (
          <div>
            <p className="text-sm text-ink-2">{t('ui.intro')}</p>
            <p className="mb-2.5 mt-5 text-xs font-medium text-ink-3">{t('ui.presetsTitle')}</p>
            <Chips items={presets.map((p) => p.question)} onAsk={ask} />
          </div>
        ) : (
          messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-[14px] rounded-br-[4px] bg-violet-50 px-3.5 py-2 text-sm text-ink">
                  <span className="sr-only">{t('ui.you')}: </span>
                  {m.text}
                </p>
              </div>
            ) : (
              <article
                key={m.id}
                aria-label={t('ui.answerFor', { question: m.answer.question })}
                className="space-y-3"
              >
                <AiBadge variant="soft" />
                <div className="space-y-2 text-sm leading-relaxed text-ink">
                  {m.answer.paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
                {m.answer.intent === null && (
                  <Chips items={m.answer.suggestions} onAsk={ask} disabled={!!pending} />
                )}
                {m.answer.references.length > 0 && (
                  <div className="space-y-2" aria-label={t('ui.references')} role="group">
                    {m.answer.references.map((r, i) => (
                      <ReferenceCard key={i} r={r} />
                    ))}
                  </div>
                )}
              </article>
            ),
          )
        )}
        {pending && <Thinking />}
        {!pending && lastAi && lastAi.role === 'ai' && lastAi.answer.intent !== null && (
          <div>
            <p className="mb-2 text-xs font-medium text-ink-3">{t('ui.followUp')}</p>
            <Chips items={lastAi.answer.suggestions} onAsk={ask} />
          </div>
        )}
      </div>
      <form
        className="border-t border-border bg-surface px-4 pb-4 pt-3 sm:px-5"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <div className="flex items-end gap-2 rounded-md border border-border-strong bg-surface p-1.5 pl-3 focus-within:border-violet-400">
          <label htmlFor="copilot-input" className="sr-only">
            {t('ui.inputLabel')}
          </label>
          <textarea
            id="copilot-input"
            ref={inputRef}
            rows={1}
            value={input}
            disabled={!data}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            placeholder={t('ui.placeholder')}
            className="max-h-28 min-h-[34px] flex-1 resize-none bg-transparent py-1.5 text-sm text-ink outline-none placeholder:text-ink-3 focus-visible:outline-none"
          />
          <Button
            type="submit"
            size="icon-sm"
            variant="default"
            disabled={!input.trim() || !!pending || !data}
            aria-label={t('ui.send')}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-ink-3">
          <span>{t('ui.disclaimer')}</span>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                clearChat();
                inputRef.current?.focus();
              }}
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-sm px-1 py-0.5 hover:bg-violet-50 hover:text-ink',
              )}
            >
              <RotateCcw className="size-3" strokeWidth={1.75} aria-hidden="true" />
              {t('ui.clear')}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
