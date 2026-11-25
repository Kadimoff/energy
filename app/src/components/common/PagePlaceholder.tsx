import { Hammer } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { useT, type Namespace } from '@/i18n';
import { EmptyState } from './EmptyState';

/** Temporary page body used until the page agent replaces its folder. */
export function PagePlaceholder({ ns, title }: { ns: Namespace; title?: string }) {
  const { tx } = useT(ns);
  return (
    <>
      <PageHeader title={title ?? tx('title')} subtitle={tx('subtitle')} />
      <Card>
        <EmptyState
          icon={Hammer}
          title={title ?? tx('title')}
          body={tx('common:states.placeholder')}
        />
      </Card>
    </>
  );
}
