"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const amqp = require("amqplib");
const debug_1 = require("./debug");
const events_1 = require("events");
const url = require("url");
const backoff = require('backoff');
const debug = debug_1.default('connection-manager');
class ConnectionManager extends events_1.EventEmitter {
    constructor(connectionURL, options = {}) {
        super();
        this.connectionURL = connectionURL;
        this.options = ConnectionManager.mergeOptionsWithDefaults(options);
        this.assertURLCorrectness();
    }
    /**
     * Merges options with default ones defined on ConnectionManager
     *
     * @param options
     */
    static mergeOptionsWithDefaults(options = {}) {
        return Object.assign({}, ConnectionManager.defaultOptions, options, {
            connection: Object.assign(ConnectionManager.defaultOptions.connection, options.connection),
            reconnect: Object.assign(ConnectionManager.defaultOptions.reconnect, options.reconnect)
        });
    }
    assertURLCorrectness() {
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
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.connectWithBackoff();
                this.connection.on('error', (e) => {
                    this.emit('connection-error', e);
                    debug(`Connection error caught: ${e.message}`);
                });
                this.connection.on('close', (err) => {
                    if (err) {
                        debug('Disconnected - reconnect attempt');
                        //noinspection JSIgnoredPromiseFromCall
                        this.connect();
                    }
                    else {
                        debug('Disconnected');
                        this.emit('disconnected');
                    }
                });
            }
            catch (e) {
                debug(`Failed to connect: ${e.message}`);
                this.emit('error', e);
            }
        });
    }
    connectWithBackoff() {
        return new Promise((resolve, reject) => {
            const call = backoff.call((url, options, cb) => __awaiter(this, void 0, void 0, function* () {
                this.emit('retry', call.getNumRetries());
                debug('Connecting to queue ... ' + (call.getNumRetries() ? '- Retry #' + call.getNumRetries() : ''));
                try {
                    this.connection = yield amqp.connect(url, options);
                    debug('Connected');
                    this.emit('connected', this.connection);
                    cb(null, this.options.useConfirmChannel ? yield this.connection.createConfirmChannel() : yield this.connection.createChannel());
                }
                catch (e) {
                    debug('Connection failed: ' + e.message);
                    cb(e);
                }
            }), this.connectionURL, this.options.connection, (err, channel) => {
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
    onChannel(channel) {
        this.channel = channel;
        debug('New channel created');
        this.emit('channel', channel);
    }
    /**
     * Closes connection.
     *
     * @returns {Promise<void>}
     */
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.connection) {
                yield this.connection.close();
            }
        });
    }
}
/**
 * Default wrapper options deeply merged with user config
 */
ConnectionManager.defaultOptions = {
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
exports.default = ConnectionManager;
//# sourceMappingURL=ConnectionManager.js.map