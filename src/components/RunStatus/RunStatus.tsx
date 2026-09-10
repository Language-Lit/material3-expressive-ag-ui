import { CircularProgress, Text } from '@language-lit/material3-expressive'

import { cx } from '../../internal/classNames'
import { useAgentContext } from '../../runtime/agent-context'

export interface RunStatusProps {
  /** Shown while a run is in flight with no named step. Default `'Working'`. */
  workingLabel?: string
  className?: string
}

/**
 * The thread's single announcement point.
 *
 * A streaming reply must not be a live region — it would re-announce on every
 * token. So the transcript stays silent and this one `role="status"` region
 * owns the async policy: it names the step in flight and reports a failure.
 * It stays mounted while idle so assistive technology has a region to watch.
 *
 * The spinner is hidden from assistive technology on purpose; the region's
 * text is what gets announced, and naming both would say it twice.
 */
export function RunStatus({ workingLabel = 'Working', className }: RunStatusProps) {
  const { isRunning, phase, steps, error } = useAgentContext()
  const activeStep = steps.find((step) => step.status === 'running')

  let message = ''
  if (phase === 'error') message = error ? `Run failed: ${error.message}` : 'Run failed'
  else if (isRunning) message = activeStep ? activeStep.name : workingLabel

  return (
    <div
      role="status"
      className={cx('m3e-agui-run-status', className)}
      data-phase={phase}
      data-idle={message === '' || undefined}
    >
      {isRunning ? (
        <span aria-hidden="true" className="m3e-agui-run-status__spinner">
          <CircularProgress />
        </span>
      ) : null}
      <Text as="span" variant="labelMedium" className="m3e-agui-run-status__text">
        {message}
      </Text>
    </div>
  )
}
