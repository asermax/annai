import { rmSync, existsSync } from 'node:fs';
import { sessionPaths } from "../shared/paths.js";
import { sendCommand } from "./ipc-client.js";
const parseArgs = (argv) => {
    let sessionId;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--session' && i + 1 < argv.length) {
            sessionId = argv[i + 1];
            i++;
            continue;
        }
        throw new Error(`stop: unknown argument "${arg}"`);
    }
    if (sessionId == null)
        throw new Error('stop: --session <id> is required');
    return { sessionId };
};
export const runStop = async (argv) => {
    const { sessionId } = parseArgs(argv);
    const paths = sessionPaths(sessionId);
    if (existsSync(paths.sock)) {
        try {
            await sendCommand(paths.sock, { op: 'stop' }, 3000);
        }
        catch {
            // daemon may have died already; proceed to remove the session dir anyway
        }
    }
    // give the daemon a moment to clean up its socket, then nuke the dir
    await new Promise(r => setTimeout(r, 200));
    if (existsSync(paths.dir)) {
        rmSync(paths.dir, { recursive: true, force: true });
    }
    process.stdout.write(JSON.stringify({ sessionId, stopped: true }) + '\n');
};
//# sourceMappingURL=stop.js.map