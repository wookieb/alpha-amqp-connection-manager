# AMQP Connection manager
[![TypeScript](https://badges.frapsoft.com/typescript/code/typescript.svg?v=101)](https://github.com/ellerbrock/typescript-badges/)
[![CircleCI](https://circleci.com/gh/wookieb/alpha-amqp-connection-manager.svg?style=svg)](https://circleci.com/gh/wookieb/alpha-amqp-connection-manager)



Wrapper for [amqplib](https://github.com/squaremo/amqp.node) connection that reconnects on failure.

## Installation

## Usage

```
import {connect} from 'alpha-amqp-connection-wrapper';

connect('amqp://your.connection:1010/string?heartbeat=10')
	.then((connection) => {
		connection.channel;
		connection.connection;
	})
```

## Events
- `retry` - on connection retry with number of retry attempt
- `connection-error` - on internal connection error
- `connected` - once connection established
- `disconnected` - obvious
- `channel` - once channel created
- `error` - hard fail once we reach maximum amount of retry attempts

## Configuration options
- `connection` - any value provided to ampq.connect
- `useConfirmChannel` - Whether to use confirm channel - default false
- `reconnect`
	- `failAfter` - maximum amount of reconnect attempts - default no limit
	- `backoffStrategy` - [backoff strategy](https://www.npmjs.com/package/backoff#interface-backoffstrategy) to use. Note that _alpha-amqp-connection-manager_ exports "backoff" module so you don't need to have it defined in your local package.json in order to use it.

### Debugging 
The library uses great [debugFn](https://www.npmjs.com/package/debug) package.
Call your app with DEBUG env variable set in order to see debugFn messages.

```
DEBUG=alpha-amqp-connection-manager:*
```

## Full API
Available as Typescript [definition files](./compiled/index.d.ts)

