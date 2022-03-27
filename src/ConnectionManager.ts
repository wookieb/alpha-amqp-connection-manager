import * as amqp from 'amqplib';
import {debugFn} from './debugFn';
import {EventEmitter} from 'events';
import * as url from "url";
import * as backoff from 'backoff';

const debug = debugFn('connection-manager');

export class ConnectionManager extends EventEmitter {
	public connection?: amqp.Connection;
	public channel?: amqp.Channel;

	/**
	 * Default wrapper options deeply merged with user config
	 */
	static defaultOptions: ConnectionManager.Options = {
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

	private options: ConnectionManager.Options;

	constructor(private connectionURL: string, options: ConnectionManager.Options.FromUser = {}) {
		super();

		this.options = ConnectionManager.mergeOptionsWithDefaults(options);

		this.assertURLCorrectness();
	}

	/**
	 * Merges options with default ones defined on ConnectionManager
	 */
	static mergeOptionsWithDefaults(options: ConnectionManager.Options.FromUser = {}): ConnectionManager.Options {
		return {
			...ConnectionManager.defaultOptions,
			...options,
			connection: Object.assign(ConnectionManager.defaultOptions.connection, options.connection),
			reconnect: Object.assign(ConnectionManager.defaultOptions.reconnect, options.reconnect)
		};
	}

	private assertURLCorrectness() {
		const parts = url.parse(this.connectionURL, true);
		const heartbeat = parseInt(parts.query.heartbeat as string, 10);
		if (isNaN(heartbeat) || heartbeat < 1) {
			// eslint-disable-next-line no-console
			console.warn(`"heartbeat" options is missing in your connection URL. This might lead to unexpected connection loss.`);
		}
	}

	/**
	 * Connects to AMQP broker
	 */
	public async connect(): Promise<void> {
		try {
			await this.connectWithBackoff();
			this.connection!.on('error', (e: Error) => {
				this.emit('connection-error', e);
				debug(`Connection error caught: ${e.message}`);
			});

			this.connection!.on('close', (err: Error) => {
				if (err) {
					debug('Disconnected - reconnect attempt');
					this.connect();
				} else {
					debug('Disconnected');
					this.emit('disconnected');
				}
			})
		} catch (e: any) {
			debug(`Failed to connect: ${e.message}`);
			this.emit('error', e);
		}
	}

	private connectWithBackoff() {
		return new Promise((resolve, reject) => {
			const call = backoff.call(async (url: string, options: any, cb: Function) => {
				this.emit('retry', call.getNumRetries());
				debug(`Connecting to queue ... ${call.getNumRetries() ? `- Retry #${call.getNumRetries()}` : ''}`);

				try {
					this.connection = await amqp.connect(url, options);
					debug('Connected');
					this.emit('connected', this.connection);

					// eslint-disable-next-line no-null/no-null
					cb(null, this.options.useConfirmChannel ? await this.connection.createConfirmChannel() : await this.connection.createChannel());
				} catch (e: any) {
					debug(`Connection failed: ${e.message}`);
					cb(e);
				}
			}, this.connectionURL, this.options.connection, (err: Error, channel: amqp.Channel) => {
				if (err) {
					reject(err);
					return;
				}

				this.onChannel(channel);
				resolve(undefined);
			});

			call.failAfter(this.options.reconnect.failAfter ?? 0);
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
	 */
	async disconnect() {
		if (this.connection) {
			await this.connection.close();
		}
	}
}


export namespace ConnectionManager {
	export interface Options {
		/**
		 * Options provided to amqp.connect
		 */
		connection: any,

		/**
		 * Whether to use confirm channel - http://www.squaremobius.net/amqp.node/channel_api.html#confirmchannel
		 */
		useConfirmChannel: boolean;

		reconnect: {
			/**
			 * Maximum amount of reconnect attempts - default no limit
			 */
			failAfter?: number,

			/**
			 * "backoff" module strategy - if not provided then "exponential" strategy is used
			 *
			 * See https://github.com/MathieuTurcotte/node-backoff#interface-backoffstrategy for details
			 */
			backoffStrategy: backoff.BackoffStrategy
		}
	}

	export namespace Options {
		export type FromUser = Partial<Pick<Options, 'connection' | 'useConfirmChannel'>> & { reconnect?: Partial<Options['reconnect']> };
	}
}
