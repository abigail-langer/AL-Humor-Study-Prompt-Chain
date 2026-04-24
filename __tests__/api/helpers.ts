/**
 * Shared helpers for API route tests.
 * Creates mock Supabase clients and Request objects.
 */

export function makeJsonRequest(body: unknown, method = 'POST'): Request {
  return new Request('http://localhost/api/test', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function makeGetRequest(url = 'http://localhost/api/test'): Request {
  return new Request(url, { method: 'GET' })
}

/** Returns a chainable Supabase query mock whose terminal method resolves to `result`. */
export function makeQueryChain(result: unknown) {
  const chain: Record<string, jest.Mock> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit', 'single', 'or', 'from']
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain)
  }
  // Make the terminal async resolvers
  for (const terminal of ['single', 'limit', 'or']) {
    chain[terminal] = jest.fn().mockResolvedValue(result)
  }
  // Non-terminal methods return chain; async resolution via awaiting the chain object itself
  chain.then = undefined // ensure it isn't thenable except via explicit terminal
  return chain
}

/** Supabase session mock – authenticated */
export const AUTHED_SESSION = {
  data: {
    session: { access_token: 'mock-token', user: { id: 'user-1' } },
  },
}

/** Supabase session mock – unauthenticated */
export const NO_SESSION = { data: { session: null } }
