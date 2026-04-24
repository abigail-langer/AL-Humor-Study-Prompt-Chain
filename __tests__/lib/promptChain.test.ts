import { runPromptChain } from '@/lib/promptChain'
import type { PromptChainStep } from '@/lib/types'

const makeStep = (overrides: Partial<PromptChainStep> = {}): PromptChainStep => ({
  id: 'step-1',
  role: 'user',
  label: 'Test Step',
  template: '{{input}}',
  ...overrides,
})

// ─── Variable interpolation ───────────────────────────────────────────────────

describe('runPromptChain – variable interpolation', () => {
  it('replaces {{input}} with the provided input', () => {
    const result = runPromptChain({
      input: 'hello world',
      steps: [makeStep({ template: 'Describe this: {{input}}' })],
    })
    expect(result.compiledSteps[0].prompt).toBe('Describe this: hello world')
  })

  it('replaces {{input}} with spaces around the variable name', () => {
    const result = runPromptChain({
      input: 'test',
      steps: [makeStep({ template: '{{ input }}' })],
    })
    expect(result.compiledSteps[0].prompt).toBe('test')
  })

  it('replaces {{step_1_output}} in subsequent steps', () => {
    const steps: PromptChainStep[] = [
      makeStep({ id: 's1', label: 'Step 1', template: 'First: {{input}}' }),
      makeStep({ id: 's2', label: 'Step 2', template: 'Second: {{step_1_output}}' }),
    ]
    const result = runPromptChain({ input: 'ping', steps })
    const step2Prompt = result.compiledSteps[1].prompt
    expect(step2Prompt).toContain('Second: ')
    expect(step2Prompt).toContain('[Simulated output for Step 1]')
  })

  it('leaves unknown variables as empty string', () => {
    const result = runPromptChain({
      input: 'x',
      steps: [makeStep({ template: 'Hello {{unknown_var}}!' })],
    })
    expect(result.compiledSteps[0].prompt).toBe('Hello !')
  })

  it('replaces multiple occurrences of the same variable', () => {
    const result = runPromptChain({
      input: 'cat',
      steps: [makeStep({ template: '{{input}} and {{input}}' })],
    })
    expect(result.compiledSteps[0].prompt).toBe('cat and cat')
  })

  it('handles template with no variables', () => {
    const result = runPromptChain({
      input: 'ignored',
      steps: [makeStep({ template: 'Static text only' })],
    })
    expect(result.compiledSteps[0].prompt).toBe('Static text only')
  })
})

// ─── Step chaining ────────────────────────────────────────────────────────────

describe('runPromptChain – step chaining', () => {
  it('chains three steps, each using the prior step output', () => {
    const steps: PromptChainStep[] = [
      makeStep({ id: 's1', label: 'A', template: '{{input}}' }),
      makeStep({ id: 's2', label: 'B', template: 'got: {{step_1_output}}' }),
      makeStep({ id: 's3', label: 'C', template: 'final: {{step_2_output}}' }),
    ]
    const result = runPromptChain({ input: 'seed', steps })
    expect(result.compiledSteps).toHaveLength(3)
    // Each compiled step prompt should be a non-empty string
    result.compiledSteps.forEach(s => expect(s.prompt.length).toBeGreaterThan(0))
  })

  it('preserves id, role, and label on compiled steps', () => {
    const step = makeStep({ id: 'abc', role: 'system', label: 'My Step', template: '{{input}}' })
    const result = runPromptChain({ input: 'hi', steps: [step] })
    expect(result.compiledSteps[0]).toMatchObject({ id: 'abc', role: 'system', label: 'My Step' })
  })
})

// ─── finalOutput ──────────────────────────────────────────────────────────────

describe('runPromptChain – finalOutput', () => {
  it('returns empty string when steps array is empty', () => {
    const result = runPromptChain({ input: 'anything', steps: [] })
    expect(result.finalOutput).toBe('')
    expect(result.compiledSteps).toHaveLength(0)
  })

  it('finalOutput is derived from the last step', () => {
    const steps: PromptChainStep[] = [
      makeStep({ id: 's1', label: 'First', template: '{{input}}' }),
      makeStep({ id: 's2', label: 'Last', template: 'last: {{input}}' }),
    ]
    const result = runPromptChain({ input: 'data', steps })
    expect(result.finalOutput).toContain('[Simulated output for Last]')
  })

  it('finalOutput includes truncated prompt (≤220 chars)', () => {
    const longInput = 'a'.repeat(300)
    const result = runPromptChain({
      input: longInput,
      steps: [makeStep({ label: 'Big', template: '{{input}}' })],
    })
    // The simulated output is: "[Simulated output for Big] " + prompt.slice(0, 220)
    // prompt = longInput (300 chars), so slice is 220 chars → total is 27 + 220 = 247
    expect(result.finalOutput.length).toBeLessThanOrEqual(300)
    expect(result.finalOutput).toContain('[Simulated output for Big]')
  })

  it('returns correct compiledSteps count', () => {
    const steps = Array.from({ length: 5 }, (_, i) =>
      makeStep({ id: `s${i}`, label: `Step ${i}`, template: '{{input}}' })
    )
    const result = runPromptChain({ input: 'x', steps })
    expect(result.compiledSteps).toHaveLength(5)
  })
})
