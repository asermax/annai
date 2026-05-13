import { readFileSync, writeFileSync, renameSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { surfaceSchema } from "../shared/surface.js";
export class Session {
    sessionId;
    surface;
    state;
    constructor(init) {
        this.sessionId = init.sessionId;
        this.surface = init.surface;
        this.state = {
            sessionId: init.sessionId,
            port: null,
            startedAt: new Date().toISOString(),
            decision: 'pending',
            drafts: [],
            threads: [],
        };
    }
    setPort(port) {
        this.state = { ...this.state, port };
    }
    snapshot() {
        return { ...this.state };
    }
}
// atomic write: write to tmp, rename onto target
export const writeStateAtomic = (statePath, snapshot) => {
    mkdirSync(dirname(statePath), { recursive: true });
    const tmp = `${statePath}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
    renameSync(tmp, statePath);
};
export const appendEventLog = (eventsPath, event) => {
    mkdirSync(dirname(eventsPath), { recursive: true });
    appendFileSync(eventsPath, JSON.stringify(event) + '\n', 'utf8');
};
export const loadSurface = (surfacePath) => {
    const raw = readFileSync(surfacePath, 'utf8');
    const parsed = JSON.parse(raw);
    return surfaceSchema.parse(parsed);
};
//# sourceMappingURL=session.js.map