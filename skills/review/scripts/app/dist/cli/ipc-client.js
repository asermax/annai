import { createConnection } from 'node:net';
import { encodeFrame, createFrameDecoder } from "../daemon/ipc.js";
export const sendCommand = (socketPath, command, timeoutMs = 5000) => {
    return new Promise((resolveOuter, rejectOuter) => {
        const socket = createConnection(socketPath);
        const decoder = createFrameDecoder();
        const timer = setTimeout(() => {
            socket.destroy();
            rejectOuter(new Error(`ipc command "${command.op}" timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        socket.on('connect', () => {
            socket.write(encodeFrame({ kind: 'command', command }));
        });
        socket.on('data', chunk => {
            decoder.push(chunk);
            const frames = decoder.drain();
            if (frames.length === 0)
                return;
            clearTimeout(timer);
            socket.end();
            resolveOuter(frames[0]);
        });
        socket.on('error', err => {
            clearTimeout(timer);
            rejectOuter(err);
        });
    });
};
//# sourceMappingURL=ipc-client.js.map