// Parse-only validation against the bundled mermaid renderer. The CLI
// surfaces a syntax failure before the surface ever reaches the browser,
// where a render failure would degrade silently into an empty diagram.
// mermaid.parse() runs in node without a DOM (verified against 11.4.1).

let mermaidPromise: Promise<unknown> | null = null

const getMermaid = (): Promise<unknown> => {
  if (mermaidPromise == null) {
    mermaidPromise = import('mermaid').then(m => m.default)
  }
  return mermaidPromise
}

export const validateMermaidSourceOrThrow = async (cmd: string, source: string): Promise<void> => {
  const mermaid = await getMermaid() as { parse: (text: string) => Promise<unknown> }

  try {
    await mermaid.parse(source)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(
      `${cmd}: mermaid syntax error\n  ${message}\n  hint: pass --skip-validate to bypass`,
    )
  }
}
