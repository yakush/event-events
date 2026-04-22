# TODO

## API additions to consider

- **`waitFor(event, signal?)`** — returns a `Promise` that resolves with the event args on the next emit. Optional `AbortSignal` for timeout / cancellation (`AbortSignal.timeout(ms)` requires Node ≥ 18, which is already the engine minimum).

- **Wildcard listeners** — `emitter.on('*', (event, ...args) => ...)`. Useful for logging, debugging, and middleware. Would live in a separate internal bucket, merged with named-event listeners at emit time.

- **`pipe(otherEmitter)`** — forwards all events from this emitter to another. Useful for event-bus patterns.

- **Node-style `error` event** — if `emit('error', err)` is called with no listeners registered, throw instead of returning `false`. Matches Node's `EventEmitter` contract. Questionable API design (whether a listener is registered changes crash behavior at the source), but useful if Node drop-in compatibility is a goal.
