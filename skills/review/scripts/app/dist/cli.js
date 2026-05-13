import { runStart } from "./cli/start.js";
import { runStop } from "./cli/stop.js";
import { runStatus } from "./cli/status.js";
import { runSessions } from "./cli/sessions.js";
import { runWatch } from "./cli/watch.js";
import { runReply } from "./cli/reply.js";
import { runResult } from "./cli/result.js";
const USAGE = `usage: annai.sh <command> [args]

commands:
  start    --surface <path> --session <id> [--repo <path>] [--no-open]
  stop     --session <id>
  status   --session <id>
  sessions
  watch    (v0.1: not yet implemented)
  reply    (v0.1: not yet implemented)
  result   (v0.1: not yet implemented)
`;
const HANDLERS = {
    start: runStart,
    stop: runStop,
    status: runStatus,
    sessions: runSessions,
    watch: runWatch,
    reply: runReply,
    result: runResult,
};
const main = async () => {
    const [, , subcommand, ...rest] = process.argv;
    if (subcommand == null || subcommand === '-h' || subcommand === '--help') {
        process.stdout.write(USAGE);
        return;
    }
    const handler = HANDLERS[subcommand];
    if (handler == null) {
        process.stderr.write(`annai: unknown command "${subcommand}"\n\n${USAGE}`);
        process.exit(1);
    }
    await handler(rest);
};
main().catch(err => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`annai: ${message}\n`);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map