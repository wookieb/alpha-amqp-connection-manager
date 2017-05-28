import * as amqp from 'amqplib';
import debugFn from './debug';
import {EventEmitter} from 'events';
import * as url from "url";
const backoff = require('backoff');
const debug = debugFn('connection-manager');

export interface ConnectionManagerOptions {
    /**
     * Options provided to amqp.connect
     */
    connection?: any,
    reconnect?: ReconnectOptions
}

export interface ReconnectOptions {
    /**
     * Maximum amount of reconnect attempts - default no limit
     */
    failAfter?: number,
    /**
     * "backoff" module strategy - if not provided then "exponential" strategy is used
     *
     * See https://github.com/MathieuTurcotte/node-backoff#interface-backoffstrategy for details
     */
    backoffStrategy?: any
}

export default class ConnectionManager extends EventEmitter {

    public connection: amqp.Connection;
    public channel: amqp.Channel;

    static defaultConnectionOptions: any = {};
    static defaultReconnectOptions: ReconnectOptions = {
        backoffStrategy: new backoff.ExponentialStrategy({
            initialDelay: 1000,
            maxDelay: 30000,
            randomisationFactor: Math.random()
        }),
        failAfter: 0
    };

    constructor(private connectionURL: string, private options?: ConnectionManagerOptions) {
        super();
        this.options = this.options || {};

        this.assertURLCorrectness();
    }

    private assertURLCorrectness() {
        const parts = url.parse(this.connectionURL, true);
        const heartbeat = parseInt(parts.query.heartbeat, 10);
        if (isNaN(heartbeat) || heartbeat < 1) {
            console.warn(`"heartbeat" options is missing in your connection URL. This might lead to unexpected connection loss.`);
        }
    }

    /**
     * Connects to AMQP broker
     *
     * @returns {Promise<void>}
     */
    public async connect(): Promise<void> {
        try {
            await this.connectWithBackoff();
            this.connection.on('close', (err: Error) => {
                if (err) {
                    debug('Disconnected - reconnect attempt');
                    //noinspection JSIgnoredPromiseFromCall
                    this.connect();
                } else {
                    debug('Disconnected');
                    this.emit('disconnected');
                }
            })

        } catch (e) {
            debug(`Failed to connect: ${e.message}`);
            this.emit('error', e);
        }
    }

    private connectWithBackoff(): Promise<amqp.Connection> {
        const connectionOptions = Object.assign({}, ConnectionManager.defaultConnectionOptions, this.options.connection);

        return new Promise((resolve, reject) => {
            const call = backoff.call(async (url: string, options: any, cb: Function) => {
                this.emit('retry', call.getNumRetries());
                debug('Connecting to queue ... ' + (call.getNumRetries() ? '- Retry #' + call.getNumRetries() : ''));

                try {
                    this.connection = await amqp.connect(url, options);
                    debug('Connected');
                    this.emit('connected', this.connection);

                    cb(null, await this.connection.createChannel());
                } catch (e) {
                    debug('Connection failed: ' + e.message);
                    cb(e);
                }
            }, this.connectionURL, connectionOptions, (err: Error, channel: amqp.Channel) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.onChannel(channel);
                resolve();
            });

            const reconnectOptions = <ReconnectOptions>Object.assign({}, ConnectionManager.defaultReconnectOptions, this.options.reconnect);

            call.failAfter(reconnectOptions.failAfter);
            call.setStrategy(reconnectOptions.backoffStrategy);
            call.start();
        });
    }

    private onChannel(channel: amqp.Channel) {
        this.channel = channel;
        debug('New channel created');

        this.emit('channel', channel);
    }

    /**
     * Closes connection.
     * If you want to wait for all consumers to finish their task then call {@see stopAllConsumers} before disconnecting.
     *
     * @returns {Promise<void>}
     */
    async disconnect() {
        if (this.connection) {
            await this.connection.close();
        }
    }
}