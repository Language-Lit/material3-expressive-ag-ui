import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { AbstractAgent } from '@ag-ui/client'

import type { ToolCallNode } from '../protocol/timeline.types'
import { useAgent } from './useAgent'
import type { UseAgentOptions, UseAgentResult } from './useAgent'

export interface ToolRendererProps {
  /** The call being rendered, including partially-parsed arguments. */
  node: ToolCallNode
  /** The bound agent, for renderers that answer or act on the call. */
  agent: UseAgentResult
}

/**
 * Generative UI: a component that renders one named tool call in place of the
 * default card. It is called while arguments are still streaming, so it must
 * tolerate `node.args` being partial or `undefined` — that is what lets the UI
 * fill in as the call arrives instead of popping in when it closes.
 */
export type ToolRenderer = (props: ToolRendererProps) => ReactNode

/** Tool name to renderer. Names not present here fall back to `ToolCallCard`. */
export type ToolRendererRegistry = Readonly<Record<string, ToolRenderer>>

interface AgentContextValue {
  agent: UseAgentResult
  toolRenderers: ToolRendererRegistry
}

const AgentContext = createContext<AgentContextValue | undefined>(undefined)

export interface AgentProviderProps extends UseAgentOptions {
  /** The agent to bind. Ownership stays with the caller. */
  agent: AbstractAgent
  /** Per-tool generative UI renderers. */
  toolRenderers?: ToolRendererRegistry
  children: ReactNode
}

const NO_RENDERERS: ToolRendererRegistry = {}

/**
 * Bind one agent and share it with every component below.
 *
 * This is the only place `useAgent` is called on a given agent, so a thread, a
 * composer and a state inspector in different corners of the tree all read one
 * subscription and one snapshot.
 */
export function AgentProvider({
  agent,
  toolRenderers = NO_RENDERERS,
  children,
  ...options
}: AgentProviderProps) {
  const { includeReasoning, includeSystem, tools, context, forwardedProps } = options
  const bound = useAgent(agent, { includeReasoning, includeSystem, tools, context, forwardedProps })
  const value = useMemo<AgentContextValue>(
    () => ({ agent: bound, toolRenderers }),
    [bound, toolRenderers],
  )
  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>
}

/** The bound agent from the nearest `AgentProvider`. */
export function useAgentContext(): UseAgentResult {
  return useAgentContextValue().agent
}

export function useToolRenderers(): ToolRendererRegistry {
  return useAgentContextValue().toolRenderers
}

function useAgentContextValue(): AgentContextValue {
  const value = useContext(AgentContext)
  if (!value) {
    throw new Error(
      'No AgentProvider found. Wrap the chat in <AgentProvider agent={agent}> from ' +
        '@language-lit/material3-expressive-ag-ui.',
    )
  }
  return value
}
