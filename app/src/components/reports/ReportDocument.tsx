import type { Report } from '@/services/ReportService';
import { CarbonReportView } from './CarbonReportView';
import { DirectorReportView } from './DirectorReportView';
import { EnergyManagerReportView } from './EnergyManagerReportView';
import { IsoReportView } from './IsoReportView';

/** All A4 pages of a report (preview and print copy render the same tree). */
export function ReportDocument({ report }: { report: Report }) {
  switch (report.template) {
    case 'director':
      return <DirectorReportView report={report} />;
    case 'energy_manager':
      return <EnergyManagerReportView report={report} />;
    case 'carbon':
      return <CarbonReportView report={report} />;
    case 'iso50001':
      return <IsoReportView report={report} />;
  }
}
