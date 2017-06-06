"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug = require("debug");
function default_1(suffix) {
    return debug('alpha-amqp-connection-manager' + (suffix ? ':' + suffix : ''));
}
exports.default = default_1;
//# sourceMappingURL=debug.js.map