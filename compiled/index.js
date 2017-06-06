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
exports.backoff = require('backoff');
const ConnectionManager_1 = require("./ConnectionManager");
var ConnectionManager_2 = require("./ConnectionManager");
exports.ConnectionManager = ConnectionManager_2.default;
function connect(url, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const manager = new ConnectionManager_1.default(url, options);
        yield manager.connect();
        return manager;
    });
}
exports.connect = connect;
//# sourceMappingURL=index.js.map