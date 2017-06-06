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

    /**
     * Whether to use confirm channel - http://www.squaremobius.net/amqp.node/channel_api.html#confirmchannel
     */
    useConfirmChannel?: boolean;

    reconnect?: {
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
}

export default class ConnectionManager extends EventEmitter {

    public connection: amqp.Connection;
    public channel: amqp.Channel;

    /**
     * Default wrapper options deeply merged with user config
     */
    static defaultOptions: ConnectionManagerOptions = {
        useConfirmChannel: false,
        reconnect: {
            backoffStrategy: new backoff.ExponentialStrategy({
                initialDelay: 1000,
                maxDelay: 30000,
                randomisationFactor: Math.random()
            }),
            failAfter: 0
        },
        connection: {}
    };

    private options: ConnectionManagerOptions;

    constructor(private connectionURL: string, options: ConnectionManagerOptions = {}) {
        super();

        this.options = ConnectionManager.mergeOptionsWithDefaults(options);

        this.assertURLCorrectness();
    }

    /**
     * Merges options with default ones defined on ConnectionManager
     *
     * @param options
     */
    static mergeOptionsWithDefaults(options: ConnectionManagerOptions = {}): ConnectionManagerOptions {
        return Object.assign(
            {},
            ConnectionManager.defaultOptions,
            options,
            {
                connection: Object.assign(ConnectionManager.defaultOptions.connection, options.connection),
                reconnect: Object.assign(ConnectionManager.defaultOptions.reconnect, options.reconnect)
            }
        );
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
            this.connection.on('error', (e: Error) => {
                this.emit('connection-error', e);
                debug(`Connection error caught: ${e.message}`);
            });

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

        return new Promise((resolve, reject) => {
            const call = backoff.call(async (url: string, options: any, cb: Function) => {
                this.emit('retry', call.getNumRetries());
                debug('Connecting to queue ... ' + (call.getNumRetries() ? '- Retry #' + call.getNumRetries() : ''));

                try {
                    this.connection = await amqp.connect(url, options);
                    debug('Connected');
                    this.emit('connected', this.connection);

                    cb(null, this.options.useConfirmChannel ? await this.connection.createConfirmChannel() : await this.connection.createChannel());
                } catch (e) {
                    debug('Connection failed: ' + e.message);
                    cb(e);
                }
            }, this.connectionURL, this.options.connection, (err: Error, channel: amqp.Channel) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.onChannel(channel);
                resolve();
            });

            call.failAfter(this.options.reconnect.failAfter);
            call.setStrategy(this.options.reconnect.backoffStrategy);
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
     *
     * @returns {Promise<void>}
     */
    async disconnect() {
        if (this.connection) {
            await this.connection.close();
        }
    }
}