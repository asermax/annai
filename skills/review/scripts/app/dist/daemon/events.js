import { EMITTED_ON_WATCH } from "../shared/events.js";
export class EventBus {
    listeners = [];
    emit(event) {
        for (const { fn, watchFilter } of this.listeners) {
            if (watchFilter && !EMITTED_ON_WATCH.has(event.kind))
                continue;
            try {
                fn(event);
            }
            catch {
                // listeners must not throw out of the bus
            }
        }
    }
    subscribe(fn, opts = {}) {
        const entry = { fn, watchFilter: opts.watchFilter ?? false };
        this.listeners.push(entry);
        return () => {
            this.listeners = this.listeners.filter(other => other !== entry);
        };
    }
}
export const shouldEmitOnWatch = (kind) => EMITTED_ON_WATCH.has(kind);
//# sourceMappingURL=events.js.map