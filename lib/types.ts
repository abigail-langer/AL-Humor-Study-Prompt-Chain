export type PromptChainRole = 'system' | 'user' | 'assistant'

export type PromptChainStep = {
  id: string
  role: PromptChainRole
  label: string
  template: string
}

export type PromptChainRunRequest = {
  input: string
  steps: PromptChainStep[]
}

export type PromptChainRunResult = {
  compiledSteps: Array<{
    id: string
    role: PromptChainRole
    label: string
    prompt: string
  }>
  finalOutput: string
}
