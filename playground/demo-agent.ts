import type { RunAgentInput } from '@ag-ui/core'

import { ScriptedAgent, script } from '../fixtures/scripted-agent'

/**
 * A scripted agent that walks through one protocol feature per turn, so the
 * playground demonstrates the whole surface with no backend. The scenario is
 * chosen from the transcript rather than a counter, so it survives StrictMode's
 * double render.
 */

const SCENARIOS = [
  'streaming text, reasoning and a tool call',
  'steps and an activity note',
  'generative UI from streaming arguments',
  'a run that stops to ask permission',
  'a run that fails',
]

function scenarioFor(input: RunAgentInput): number {
  const turns = input.messages.filter((message) => message.role === 'user').length
  return Math.max(0, turns - 1) % SCENARIOS.length
}

export function describeNextScenario(userTurns: number): string {
  return SCENARIOS[userTurns % SCENARIOS.length]!
}

function scriptFor(input: RunAgentInput) {
  const suffix = input.runId.slice(0, 6)

  switch (scenarioFor(input)) {
    case 0:
      return [
        script.runStarted(input),
        ...script.reasoning(
          `r-${suffix}`,
          'The shape scale is documented under the token reference. I should search the docs before answering rather than guessing at the corner values.',
        ),
        ...script.text(`a-${suffix}`, 'Let me look that up in the documentation.'),
        ...script.toolCall(
          `c-${suffix}`,
          'search_docs',
          { query: 'shape corner tokens', limit: 5 },
          `a-${suffix}`,
        ),
        script.toolResult(`t-${suffix}`, `c-${suffix}`, '5 matches in tokens.md, styles.md'),
        ...script.text(
          `a2-${suffix}`,
          'Corner values run from extra-small at 4px through extra-extra-large at 48px, plus a `full` role at 9999px. Use the role tokens for containers.',
        ),
        script.runFinished(input),
      ]

    case 1:
      return [
        script.runStarted(input),
        script.stepStarted('Reading the component inventory'),
        script.activity(`x-${suffix}`, 'file_read', {
          path: 'docs/component-inventory.json',
          entries: 41,
        }),
        script.stepFinished('Reading the component inventory'),
        script.stepStarted('Summarising'),
        ...script.text(
          `a-${suffix}`,
          '41 components are marked conformant. The advertised support surface is exactly those entries.',
        ),
        script.stepFinished('Summarising'),
        script.runFinished(input),
      ]

    case 2:
      return [
        script.runStarted(input),
        ...script.text(`a-${suffix}`, 'Here is the forecast.'),
        ...script.toolCall(
          `c-${suffix}`,
          'show_weather',
          { city: 'Recife', temperature: 29, condition: 'Humid and bright' },
          `a-${suffix}`,
          6,
        ),
        script.toolResult(`t-${suffix}`, `c-${suffix}`, 'rendered'),
        script.runFinished(input),
      ]

    case 3:
      return [
        script.runStarted(input),
        ...script.text(
          `a-${suffix}`,
          'That would delete three files under src/legacy. I need approval first.',
        ),
        script.runInterrupted(input, [
          {
            id: `i-${suffix}`,
            reason: 'approval_required',
            message: 'Delete src/legacy/theme.ts, tokens.ts and index.ts?',
          },
        ]),
      ]

    default:
      return [
        script.runStarted(input),
        ...script.text(`a-${suffix}`, 'Contacting the index service…'),
        script.runError('The documentation index is unavailable', '503'),
      ]
  }
}

export function createDemoAgent(): ScriptedAgent {
  return new ScriptedAgent({
    pace: 16,
    script: (input) => {
      // A resumed run always continues; only a fresh turn picks a scenario.
      if (input.resume && input.resume.length > 0) {
        const resolved = input.resume.some((entry) => entry.status === 'resolved')
        return [
          script.runStarted(input),
          ...script.text(
            `a-resume-${input.runId.slice(0, 6)}`,
            resolved ? 'Deleted the three files.' : 'Left the files in place.',
          ),
          script.runFinished(input),
        ]
      }
      return scriptFor(input)
    },
  })
}
