import { Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { useT } from '@/i18n';

/**
 * Copilot body. Placeholder owned by the copilot agent: replace this file
 * (and add files in this folder) to implement the chat (spec 7.13).
 * Props: `initialPrompt` is set when another page opens the copilot with a question.
 */
export default function CopilotContent({ initialPrompt }: { initialPrompt?: string | null }) {
  const { t } = useT('layout');
  void initialPrompt;
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <EmptyState icon={Sparkles} title={t('copilot.title')} body={t('copilot.placeholder')} />
    </div>
  );
}
