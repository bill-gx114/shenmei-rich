// Read an environment variable in a way that typechecks under BOTH runtimes.
// Edge-runtime functions are typechecked without @types/node, so referencing the
// bare `process` global fails ("Cannot find name 'process'"). At runtime Vercel
// injects env vars on edge too — we just reach them via globalThis to avoid the
// node-only type.
const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };

export function envVar(key: string): string | undefined {
  return g.process?.env?.[key];
}
