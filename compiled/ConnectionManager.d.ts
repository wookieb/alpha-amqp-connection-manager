/// <reference types="node" />
import * as amqp from 'amqplib';
import { EventEmitter } from 'events';
export interface ConnectionManagerOptions {
    /**
     * Options provided to amqp.connect
     */
    connection?: any;
    /**
     * Whether to use confirm channel - http://www.squaremobius.net/amqp.node/channel_api.html#confirmchannel
     */
    useConfirmChannel?: boolean;
    reconnect?: {
        /**
         * Maximum amount of reconnect attempts - default no limit
         */
        failAfter?: number;
        /**
         * "backoff" module strategy - if not provided then "exponential" strategy is used
         *
         * See https://github.com/MathieuTurcotte/node-backoff#interface-backoffstrategy for details
         */
        backoffStrategy?: any;
    };
}
export default class ConnectionManager extends EventEmitter {
    private connectionURL;
    connection: amqp.Connection;
    channel: amqp.Channel;
    /**
     * Default wrapper options deeply merged with user config
     */
    static defaultOptions: ConnectionManagerOptions;
    private options;
    constructor(connectionURL: string, options?: ConnectionManagerOptions);
    /**
     * Merges options with default ones defined on ConnectionManager
     *
     * @param options
     */
    static mergeOptionsWithDefaults(options?: ConnectionManagerOptions): ConnectionManagerOptions;
    private assertURLCorrectness();
    /**
     * Connects to AMQP broker
     *
     * @returns {Promise<void>}
     */
    connect(): Promise<void>;
    private connectWithBackoff();
    private onChannel(channel);
    /**
     * Closes connection.
     *
     * @returns {Promise<void>}
     */
    disconnect(): Promise<void>;
}
