import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { getSessionsRoot, sessionPaths } from "../shared/paths.js";
const isPidAlive = (pid) => {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
};
export const runSessions = async (_argv) => {
    const root = getSessionsRoot();
    if (!existsSync(root)) {
        process.stdout.write(JSON.stringify({ sessions: [] }, null, 2) + '\n');
        return;
    }
    const listings = [];
    for (const entry of readdirSync(root)) {
        const paths = sessionPaths(entry);
        if (!statSync(paths.dir, { throwIfNoEntry: false })?.isDirectory())
            continue;
        let pid = null;
        if (existsSync(paths.pid)) {
            const raw = readFileSync(paths.pid, 'utf8').trim();
            const parsed = Number.parseInt(raw, 10);
            pid = Number.isFinite(parsed) ? parsed : null;
        }
        let startedAt = null;
        let port = null;
        if (existsSync(paths.state)) {
            try {
                const state = JSON.parse(readFileSync(paths.state, 'utf8'));
                startedAt = state.startedAt ?? null;
                port = state.port ?? null;
            }
            catch {
                // ignore unreadable state
            }
        }
        listings.push({
            sessionId: entry,
            pid,
            active: pid != null && isPidAlive(pid),
            startedAt,
            port,
        });
    }
    process.stdout.write(JSON.stringify({ sessions: listings }, null, 2) + '\n');
};
//# sourceMappingURL=sessions.js.map