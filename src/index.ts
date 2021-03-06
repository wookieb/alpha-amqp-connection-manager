export const backoff = require('backoff');
import {default as ConnectionManager, ConnectionManagerOptions} from "./ConnectionManager";
export {default as ConnectionManager, ConnectionManagerOptions} from './ConnectionManager';

export async function connect(url: string, options?: ConnectionManagerOptions) {
    const manager = new ConnectionManager(url, options);
    await manager.connect();
    return manager;
}