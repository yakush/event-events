# TODO

## API additions to consider

- **`subscribeOnce(event, listener)`** — like `once()` but returns an unsubscribe `() => void` instead of `this`. Currently there's no way to cancel a pending `once()` without holding the listener reference and calling `off()` manually.

- **`waitFor(event, signal?)`** — returns a `Promise` that resolves with the event args on the next emit. Optional `AbortSignal` for timeout / cancellation (`AbortSignal.timeout(ms)` requires Node ≥ 18, which is already the engine minimum).

- **Wildcard listeners** — `emitter.on('*', (event, ...args) => ...)`. Useful for logging, debugging, and middleware. Would live in a separate internal bucket, merged with named-event listeners at emit time.

- **`pipe(otherEmitter)`** — forwards all events from this emitter to another. Useful for event-bus patterns.
