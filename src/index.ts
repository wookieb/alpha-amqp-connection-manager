import {ConnectionManager} from "./ConnectionManager";

export const backoff = require('backoff');
export * from './ConnectionManager';

export async function connect(url: string, options?: ConnectionManager.Options.FromUser) {
	const manager = new ConnectionManager(url, options);
	await manager.connect();
	return manager;
}
