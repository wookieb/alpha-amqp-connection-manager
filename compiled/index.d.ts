export declare const backoff: any;
import { default as ConnectionManager, ConnectionManagerOptions } from "./ConnectionManager";
export { default as ConnectionManager, ConnectionManagerOptions } from './ConnectionManager';
export declare function connect(url: string, options?: ConnectionManagerOptions): Promise<ConnectionManager>;
