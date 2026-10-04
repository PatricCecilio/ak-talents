import { stageTone } from '../../services/pipelineFormat'
import type { StageValue } from '../../types/pipeline'

export function StageBadge({ stage, label }: { stage: StageValue; label: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${stageTone(stage)}`}>{label}</span>
}
