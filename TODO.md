# TODO

## API additions to consider

- **`pipe(otherEmitter)`** — forwards all events from this emitter to another. Useful for event-bus patterns.

- **Node-style `error` event** — if `emit('error', err)` is called with no listeners registered, throw instead of returning `false`. Matches Node's `EventEmitter` contract. Questionable API design (whether a listener is registered changes crash behavior at the source), but useful if Node drop-in compatibility is a goal.
