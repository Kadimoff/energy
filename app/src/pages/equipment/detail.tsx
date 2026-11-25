import { useParams } from 'react-router-dom';
import { PagePlaceholder } from '@/components/common/PagePlaceholder';
import { useAnalysis } from '@/stores/derived';

/** Route "/equipment/:id": placeholder, owned by the equipment page agent. */
export default function EquipmentDetailPage() {
  const { id } = useParams();
  const { data } = useAnalysis();
  const eq = data?.ds.equipment.find((e) => e.id === id);
  return <PagePlaceholder ns="equipment" title={eq?.name} />;
}
