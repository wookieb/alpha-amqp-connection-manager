import debugModule = require('debug');

export function debugFn(suffix?: string) {
	return debugModule('alpha-amqp-connection-manager' + (suffix ? ':' + suffix : ''));
}
