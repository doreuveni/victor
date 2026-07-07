import type { ReportTarget } from './types';

interface Props {
  targetType: ReportTarget;
  targetId: string;
  className?: string;
}

// Hidden for now — see git history for the flag-button + ReportModal
// implementation to restore when the report flow is ready.
export default function ReportButton(_props: Props) {
  return null;
}
