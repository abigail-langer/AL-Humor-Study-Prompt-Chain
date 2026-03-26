import type { PromptChainRunRequest, PromptChainRunResult } from '@/lib/types'

function interpolate(template: string, context: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    return context[key] ?? ''
  })
}

export function runPromptChain({ input, steps }: PromptChainRunRequest): PromptChainRunResult {
  const context: Record<string, string> = { input }

  const compiledSteps = steps.map((step, index) => {
    const prompt = interpolate(step.template, context)
    const outputKey = `step_${index + 1}_output`

    // Placeholder output strategy until model integration is wired.
    context[outputKey] = `[Simulated output for ${step.label}] ${prompt.slice(0, 220)}`

    return {
      id: step.id,
      role: step.role,
      label: step.label,
      prompt
    }
  })

  const finalOutput = context[`step_${steps.length}_output`] ?? ''

  return {
    compiledSteps,
    finalOutput
  }
}
