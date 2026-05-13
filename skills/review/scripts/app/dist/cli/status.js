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
        throw new Error(`status: unknown argument "${arg}"`);
    }
    if (sessionId == null)
        throw new Error('status: --session <id> is required');
    return { sessionId };
};
export const runStatus = async (argv) => {
    const { sessionId } = parseArgs(argv);
    const paths = sessionPaths(sessionId);
    const response = await sendCommand(paths.sock, { op: 'status' }, 3000);
    if (!response.ok)
        throw new Error(`status: ${response.error ?? 'unknown error'}`);
    process.stdout.write(JSON.stringify(response.data, null, 2) + '\n');
};
//# sourceMappingURL=status.js.map