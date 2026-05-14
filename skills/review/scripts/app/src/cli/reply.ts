export const runReply = async (_argv: string[]): Promise<void> => {
  process.stderr.write(JSON.stringify({ error: 'deferred to v0.3 (ask-agent threads)' }) + '\n')
  process.exit(1)
}
