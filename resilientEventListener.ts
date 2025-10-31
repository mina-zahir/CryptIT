import WebSocket from 'isomorphic-ws';
import { Contract, InterfaceAbi, LogDescription } from "ethers";

// ENHANCEMENT: More specific types for log levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface ResilientEventListenerArgs {
    rpcUrl: string,
    contractAddress: string,
    abi: InterfaceAbi,
    eventName: string,
    log?: (level: LogLevel, message: string, ...args: any[]) => void;
    callback?: (log: LogDescription | null) => void;
    // ENHANCEMENT: Make keep-alive and pong timeout configurable
    keepAliveCheckInterval?: number;
    expectedPongBack?: number;
}

const DEFAULT_EXPECTED_PONG_BACK = 15000;
const DEFAULT_KEEP_ALIVE_CHECK_INTERVAL = 60 * 1000;

export function resilientEventListener(args: ResilientEventListenerArgs) {
    let ws: WebSocket | null = null;
    let pingTimeout: NodeJS.Timeout | null = null;
    let keepAliveInterval: NodeJS.Timeout | null = null;
    // ENHANCEMENT: Add a flag to indicate if the listener has been stopped manually
    let stopped = false;
    // ENHANCEMENT: Exponential backoff for reconnection
    let reconnectDelay = 1000;

    const log = (level: LogLevel, message: string, ...args: any[]) => {
        if (args.log) {
            args.log(level, `[${new Date().toISOString()}] ${message}`, ...args);
        }
    };

    const connect = () => {
        if (stopped) {
            log('info', 'Listener stopped, not reconnecting.');
            return;
        }

        log('info', `Connecting to WebSocket at ${args.rpcUrl}`);
        ws = new WebSocket(args.rpcUrl);

        const contract = new Contract(args.contractAddress, args.abi);
        const topicHash = contract.getEvent(args.eventName).getFragment().topicHash;
        let subscriptionId: string;

        log('debug', `Subscribing to event listener with topic hash: ${topicHash}`);

        const request = {
            id: 1,
            method: "eth_subscribe",
            params: [
                "logs",
                {
                    topics: [topicHash],
                    address: args.contractAddress,
                }
            ]
        };

        const ping = {
            id: 2,
            method: "net_listening",
            params: [],
        };

        ws.onopen = () => {
            log('info', 'WebSocket connection opened.');
            reconnectDelay = 1000; // Reset reconnect delay on successful connection
            ws!.send(JSON.stringify(request));

            // Start keep-alive mechanism
            const keepAliveCheckInterval = args.keepAliveCheckInterval || DEFAULT_KEEP_ALIVE_CHECK_INTERVAL;
            keepAliveInterval = setInterval(() => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    log('debug', `Performing health check for subscription to '${args.eventName}'.`);
                    ws.send(JSON.stringify(ping));
                    const expectedPongBack = args.expectedPongBack || DEFAULT_EXPECTED_PONG_BACK;
                    pingTimeout = setTimeout(() => {
                        if (ws) {
                            log('warn', 'Ping timeout, terminating WebSocket connection.');
                            ws.terminate();
                        }
                    }, expectedPongBack);
                }
            }, keepAliveCheckInterval);
        };

        ws.onmessage = (event: WebSocket.MessageEvent) => {
            let parsedData;
            try {
                // ENHANCEMENT: Handle different data types from WebSocket
                if (typeof event.data === 'string') {
                    parsedData = JSON.parse(event.data);
                } else if (event.data instanceof Buffer) {
                    parsedData = JSON.parse(event.data.toString());
                } else {
                    log('warn', 'Received unexpected data type from WebSocket.', event.data);
                    return;
                }
            } catch (error) {
                log('error', 'Failed to parse JSON from WebSocket message.', error);
                return;
            }

            if (parsedData?.id === request.id) {
                subscriptionId = parsedData.result;
                log('info', `Subscription to event '${args.eventName}' established with ID '${parsedData.result}'.`);
            } else if (parsedData?.id === ping.id && parsedData?.result === true) {
                log('debug', 'Health check successful.');
                if (pingTimeout) {
                    clearTimeout(pingTimeout);
                    pingTimeout = null;
                }
            } else if (parsedData?.method === 'eth_subscription' && parsedData.params.subscription === subscriptionId) {
                const logData = parsedData.params.result;
                const eventLog = contract.interface.parseLog(logData);
                log('info', `Received event ${eventLog?.name}:`, eventLog?.args);
                if (args.callback) {
                    args.callback(eventLog);
                }
            }
        };

        ws.onerror = (err: WebSocket.ErrorEvent) => {
            log('error', 'WebSocket error:', err.message);
        };

        ws.onclose = () => {
            log('info', 'WebSocket connection closed.');
            if (keepAliveInterval) clearInterval(keepAliveInterval);
            if (pingTimeout) clearTimeout(pingTimeout);
            ws = null;

            // ENHANCEMENT: Exponential backoff for reconnection
            if (!stopped) {
                setTimeout(connect, reconnectDelay);
                reconnectDelay = Math.min(reconnectDelay * 2, 30000); // Max delay of 30 seconds
            }
        };

        // ENHANCEMENT: Handle unexpected server responses
        ws.on('unexpected-response', (_req, res) => {
            log('error', `Unexpected server response: ${res.statusCode} ${res.statusMessage}`);
            // This might indicate a configuration issue, so we should stop trying to reconnect.
            stop();
        });
    };

    const stop = () => {
        log('info', 'Stopping resilient event listener.');
        stopped = true;
        if (ws) {
            // Unsubscribe from the event
            // Note: This requires the subscription ID. The implementation for this is left out for brevity.
            ws.close();
            ws = null;
        }
        if (keepAliveInterval) clearInterval(keepAliveInterval);
        if (pingTimeout) clearTimeout(pingTimeout);
    };

    connect();

    return { stop };
}
