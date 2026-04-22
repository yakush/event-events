import type { EventListenerCombined, EventNamesCombined } from './internal/types.js';
import type { EventMap } from './types.js';

export interface EventSource<T_EventMap extends EventMap = EventMap> {
  /**
   * Adds a listener and returns an unsubscribe function.
   * Calling the returned function removes the listener.
   *
   * @example
   * ```ts
   * const unsub = emitter.subscribe('click', handler);
   * unsub(); // removes the listener
   * ```
   */
  subscribe<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
    listener: EventListenerCombined<T_EventMap, T_Event>,
  ): () => void;

  /**
   * Adds a listener for the given event. The same function can be added multiple
   * times and will be called once per registration. Returns `this` for chaining.
   */
  on<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
    listener: EventListenerCombined<T_EventMap, T_Event>,
  ): this;

  /**
   * Adds a one-time listener. It is automatically removed after the first time
   * the event is emitted. Returns `this` for chaining.
   */
  once<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
    listener: EventListenerCombined<T_EventMap, T_Event>,
  ): this;

  /**
   * Adds a one-time listener. It is automatically removed after the first time
   * Calling the returned function removes the listener.
   * (whichever happens first )
   */
  subscribeOnce<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
    listener: EventListenerCombined<T_EventMap, T_Event>,
  ): () => void;

  /** Alias for `on()`. */
  addListener<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
    listener: EventListenerCombined<T_EventMap, T_Event>,
  ): this;

  /**
   * Adds a listener at the front of the call queue so it is called before
   * any previously registered listeners. Returns `this` for chaining.
   */
  prependListener<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
    listener: EventListenerCombined<T_EventMap, T_Event>,
  ): this;

  /** Like `prependListener`, but auto-removes after the first emit. */
  prependOnceListener<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
    listener: EventListenerCombined<T_EventMap, T_Event>,
  ): this;

  /**
   * Removes the first matching registration of `listener` for `event`.
   * If the same function was registered multiple times, only the first is removed.
   * Returns `this` for chaining.
   */
  off<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
    listener: EventListenerCombined<T_EventMap, T_Event>,
  ): this;

  /** Alias for `off()`. */
  removeListener<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
    listener: EventListenerCombined<T_EventMap, T_Event>,
  ): this;

  /**
   * Removes all listeners for a specific event, or all listeners for all events
   * if no event is specified. Returns `this` for chaining.
   */
  removeAllListeners(event?: EventNamesCombined<T_EventMap>): this;

  /** Returns the number of listeners registered for the given event. */
  listenerCount(event: EventNamesCombined<T_EventMap>): number;
  /** Returns an array of event names that currently have at least one listener. */
  eventNames(): EventNamesCombined<T_EventMap>[];

  /**
   * Returns the wrapped listener functions for the given event — these include
   * the auto-remove logic injected by `once()` and `prependOnceListener()`.
   * Use `rawListeners()` to get the original functions.
   */
  listeners<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
  ): EventListenerCombined<T_EventMap, T_Event>[];

  /** Returns the original listener functions, without any once-wrapper logic. */
  rawListeners<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
  ): EventListenerCombined<T_EventMap, T_Event>[];
}
