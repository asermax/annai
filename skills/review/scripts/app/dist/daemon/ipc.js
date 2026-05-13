import { createServer } from 'node:net';
export const encodeFrame = (payload) => {
    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32BE(body.length, 0);
    return Buffer.concat([header, body]);
};
export const createFrameDecoder = () => {
    let buffer = Buffer.alloc(0);
    const frames = [];
    const tryConsume = () => {
        if (buffer.length < 4)
            return false;
        const len = buffer.readUInt32BE(0);
        if (buffer.length < 4 + len)
            return false;
        const body = buffer.subarray(4, 4 + len).toString('utf8');
        buffer = buffer.subarray(4 + len);
        frames.push(JSON.parse(body));
        return true;
    };
    return {
        push: chunk => {
            buffer = Buffer.concat([buffer, chunk]);
            while (tryConsume()) { /* keep consuming */ }
        },
        drain: () => {
            const out = frames.splice(0);
            return out;
        },
    };
};
export const startIpcServer = (opts) => {
    const { socketPath, onCommand, onWatch } = opts;
    const server = createServer(socket => {
        const decoder = createFrameDecoder();
        let unsubscribeWatch = null;
        socket.on('data', chunk => {
            decoder.push(chunk);
            const frames = decoder.drain();
            if (frames.length === 0)
                return;
            // We only ever look at the first frame to identify the connection kind.
            const first = frames[0];
            if (first.kind === 'command') {
                const cmd = first.command;
                Promise.resolve(onCommand(cmd))
                    .then(response => {
                    socket.write(encodeFrame(response));
                    socket.end();
                })
                    .catch((err) => {
                    const message = err instanceof Error ? err.message : String(err);
                    socket.write(encodeFrame({ ok: false, error: message }));
                    socket.end();
                });
                return;
            }
            if (first.kind === 'watch') {
                if (onWatch == null) {
                    socket.write(encodeFrame({ ok: false, error: 'watch not supported' }));
                    socket.end();
                    return;
                }
                unsubscribeWatch = onWatch(socket);
                return;
            }
            socket.write(encodeFrame({ ok: false, error: 'unknown frame kind' }));
            socket.end();
        });
        socket.on('close', () => {
            if (unsubscribeWatch != null)
                unsubscribeWatch();
        });
        socket.on('error', () => {
            if (unsubscribeWatch != null)
                unsubscribeWatch();
        });
    });
    return new Promise((resolveListen, rejectListen) => {
        server.once('error', rejectListen);
        server.listen(socketPath, () => {
            server.off('error', rejectListen);
            resolveListen(server);
        });
    });
};
//# sourceMappingURL=ipc.js.map