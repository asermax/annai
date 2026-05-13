import { existsSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sessionPaths } from "../shared/paths.js";
import { EventBus } from "./events.js";
import { startIpcServer } from "./ipc.js";
import { startHttpServer } from "./http.js";
import { Session, loadSurface, writeStateAtomic, appendEventLog } from "./session.js";
const here = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(here, '../frontend'); // dist/daemon → dist/frontend
const parseArgs = (argv) => {
    let sessionId;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--session' && i + 1 < argv.length) {
            sessionId = argv[i + 1];
            i++;
        }
    }
    if (sessionId == null)
        throw new Error('daemon: --session <id> is required');
    return { sessionId };
};
const main = async () => {
    const { sessionId } = parseArgs(process.argv.slice(2));
    const paths = sessionPaths(sessionId);
    const surface = loadSurface(paths.surface);
    const session = new Session({ sessionId, surface });
    const bus = new EventBus();
    bus.subscribe(event => {
        appendEventLog(paths.events, event);
    });
    // start http first so we know the port to publish in state.json
    const { server: httpServer, port } = await startHttpServer({
        frontendDir: FRONTEND_DIR,
        surface,
    });
    session.setPort(port);
    writeStateAtomic(paths.state, session.snapshot());
    // pre-empty stale socket file (from a crashed prior session)
    if (existsSync(paths.sock))
        unlinkSync(paths.sock);
    const shutdown = async (reason) => {
        const ev = { kind: 'session-aborted', at: new Date().toISOString(), reason };
        try {
            bus.emit(ev);
        }
        catch { /* best effort */ }
        try {
            httpServer.close();
        }
        catch { /* */ }
        try {
            ipcServer.close();
        }
        catch { /* */ }
        try {
            if (existsSync(paths.sock))
                unlinkSync(paths.sock);
        }
        catch { /* */ }
        // session dir is left intact for `annai sessions` to mark stale; `stop` removes it.
        process.exit(0);
    };
    const ipcServer = await startIpcServer({
        socketPath: paths.sock,
        onCommand: async (cmd) => {
            switch (cmd.op) {
                case 'ping':
                    return { ok: true, data: { sessionId, port } };
                case 'status':
                    return { ok: true, data: session.snapshot() };
                case 'stop':
                    // schedule shutdown but reply first
                    setImmediate(() => { shutdown('stop-command').catch(() => process.exit(1)); });
                    return { ok: true, data: { stopping: true } };
                case 'reply':
                case 'result':
                    return { ok: false, error: `command "${cmd.op}" not implemented in v0.1` };
                default: {
                    const exhaustive = cmd;
                    return { ok: false, error: `unknown command: ${JSON.stringify(exhaustive)}` };
                }
            }
        },
        onWatch: () => {
            // v0.1: the subscription is wired but no events flow to the agent.
            // v0.2 replaces the no-op forwarder with `socket.write(encodeFrame(event))`.
            return bus.subscribe(() => { }, { watchFilter: true });
        },
    });
    bus.emit({ kind: 'session-started', at: new Date().toISOString(), sessionId, port });
    // graceful signals
    process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
    process.on('SIGINT', () => { void shutdown('SIGINT'); });
    // keep process alive — servers do that on their own
};
main().catch(err => {
    console.error('daemon error:', err instanceof Error ? err.stack ?? err.message : String(err));
    process.exit(1);
});
//# sourceMappingURL=daemon.js.map