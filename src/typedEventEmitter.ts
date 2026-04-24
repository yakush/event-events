import type { EventSource } from './eventSource.js';
import {
  isReservedEventName,
  type EventListenerCombined,
  type EventNamesCombined,
  type EventParamsCombined,
  type ReservedEvents,
} from './internal/types.js';
import type {
  ConstructionParams,
  EventListener,
  EventMap,
  EventNames,
  EventParams,
  ListenersErrorHandlingType,
} from './types.js';

/**
 * container: { listener + metadata}
 */
type Listener<T_EventMap extends EventMap = EventMap> = {
  listener: EventListener<T_EventMap, EventNames<T_EventMap>>;
  postRemoved?: (event: EventNamesCombined<T_EventMap>) => void;
  once: boolean;
  source: EventSource<T_EventMap>;
};

type Shared<T_EventMap extends EventMap> = {
  listeners: Map<string, Array<Listener<T_EventMap>>>;
  maxListeners: number;
  listenersErrorHandling: ListenersErrorHandlingType;
};

/**
 * A fully typed event emitter. Pass your event map as the type parameter to get
 * compile-time safety on event names and listener signatures.
 *
 * @example
 * ```ts
 * type AppEvents = {
 *   userJoined: (userId: string) => void;
 *   scoreChanged: (userId: string, score: number) => void;
 * };
 *
 * const emitter = new TypedEventEmitter<AppEvents>();
 * emitter.on('userJoined', (id) => console.log(id));
 * emitter.emit('userJoined', 'alice');
 * ```
 */
export class TypedEventEmitter<
  T_EventMap extends EventMap = EventMap,
> implements EventSource<T_EventMap> {
  private static _GLOBAL_MAX_LISTENERS = 10;

  /** this will be shared for all "copies" of this event emitter / event source */
  private _shared: Shared<T_EventMap> = {
    /**  map: event -> (array:{event container})  including the internal events     */
    listeners: new Map(),
    maxListeners: TypedEventEmitter._GLOBAL_MAX_LISTENERS,
    listenersErrorHandling: 'warn',
  };

  /** Default max listeners for all new instances. Set to `0` or `Infinity` to disable. */
  static set defaultMaxListeners(value: number) {
    this._GLOBAL_MAX_LISTENERS = value;
  }
  static get defaultMaxListeners() {
    return this._GLOBAL_MAX_LISTENERS;
  }

  /** Sets the max listener threshold for this instance. Returns `this` for chaining. */
  setMaxListeners(n: number) {
    this._shared.maxListeners = n;
    return this;
  }

  /** Returns the current max listener threshold for this instance. */
  getMaxListeners() {
    return this._shared.maxListeners;
  }

  //-------------------------------------------------------
  constructor(params?: ConstructionParams) {
    this._shared.maxListeners = params?.maxListeners ?? TypedEventEmitter.defaultMaxListeners;
    this._shared.listenersErrorHandling = params?.listenersErrorHandling ?? 'warn';
  }
  //-------------------------------------------------------

  /**
   * Sets how listener exceptions are handled. Returns `this` for chaining.
   *
   * - `'warn'` — `console.warn` (default)
   * - `'log'` — `console.log`
   * - `'error'` — `console.error`
   * - `'ignore'` — swallow silently
   * - `'throw'` — rethrow; remaining listeners are not called
   * - `(event, err) => void` — custom handler
   */
  setListenersErrorHandling(e: ListenersErrorHandlingType) {
    this._shared.listenersErrorHandling = e;
    return this;
  }

  /** Returns the current error handling mode. */
  getListenersErrorHandling() {
    return this._shared.listenersErrorHandling;
  }

  /**
   * Emits an event, calling all registered listeners in order.
   * Returns `true` if at least one listener was called, `false` otherwise.
   *
   * Only user-defined events can be emitted — internal events (`newListener`,
   * `removeListener`) are fired automatically by the emitter.
   */
  emit<T_Event extends EventNames<T_EventMap>>(
    event: T_Event,
    ...args: EventParams<T_EventMap, T_Event>
  ): boolean {
    return this._emit({
      event,
      args,
      emitWildcardEvent: true,
    });
  }

  subscribe<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
    listener: EventListenerCombined<T_EventMap, T_Event>,
  ): () => void {
    const remove = () => this._removeListener({ event, listener });
    this._addListener({ event, listener });
    return remove;
  }

  on<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
    listener: EventListenerCombined<T_EventMap, T_Event>,
  ): this {
    return this._addListener({ event, listener });
  }

  once<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
    listener: EventListenerCombined<T_EventMap, T_Event>,
  ): this {
    return this._addListener({ event, listener, once: true });
  }

  subscribeOnce<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
    listener: EventListenerCombined<T_EventMap, T_Event>,
  ): () => void {
    this._addListener({ event, listener, once: true });
    return () => this._removeListener({ event, listener });
  }

  addListener<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
    listener: EventListenerCombined<T_EventMap, T_Event>,
  ): this {
    return this.on(event, listener);
  }

  prependListener<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
    listener: EventListenerCombined<T_EventMap, T_Event>,
  ): this {
    return this._addListener({ event, listener, prepend: true });
  }

  prependOnceListener<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
    listener: EventListenerCombined<T_EventMap, T_Event>,
  ): this {
    return this._addListener({ event, listener, once: true, prepend: true });
  }

  off<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
    listener: EventListenerCombined<T_EventMap, T_Event>,
  ): this {
    return this._removeListener({ event, listener });
  }

  removeListener<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
    listener: EventListenerCombined<T_EventMap, T_Event>,
  ): this {
    return this._removeListener({ event, listener });
  }

  waitFor<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
    params?: { signal: AbortSignal },
  ): Promise<EventParamsCombined<T_EventMap, T_Event>> {
    return new Promise((resolve, reject) => {
      const signal = params?.signal;
      let handled = false;

      // premature abortion
      if (signal?.aborted) {
        handled = true;
        reject(new Error('aborted'));
        return;
      }

      // handle bort
      const onAbort = () => {
        handled = true;
        this._removeListener({ event, listener });
        reject(new Error('aborted'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });

      // register event (once)
      const listener = ((...args: EventParamsCombined<T_EventMap, T_Event>) => {
        handled = true;
        signal?.removeEventListener('abort', onAbort);
        resolve(args);
      }) as EventListenerCombined<T_EventMap, T_Event>;

      const postRemoved = () => {
        if (handled) return;
        reject(new Error('removed'));
      };

      ///subscribe
      this._addListener({
        event,
        listener,
        once: true,
        postRemoved: postRemoved,
      });
    });
  }

  /**
   * Removes all listeners for a specific event, or all listeners for all events
   * if no event is specified. Returns `this` for chaining.
   */
  removeAllListeners(event?: EventNamesCombined<T_EventMap>): this {
    if (event) {
      const listeners = this.listeners(event);
      for (const listener of listeners) {
        this._removeListener({
          event,
          listener,
        });
      }
    } else {
      //resource
      const events = [...this._shared.listeners.keys()];
      for (const event of events) {
        this.removeAllListeners(event);
      }
    }
    return this;
  }

  /** Returns the number of listeners registered for the given event. */
  listenerCount(event?: EventNamesCombined<T_EventMap>): number {
    if (event) {
      return this._shared.listeners.get(event)?.length ?? 0;
    } else {
      const all = [...this._shared.listeners.values()];
      const count = all.reduce((prev, curr) => prev + curr.length, 0);
      return count;
    }
  }

  /** Returns an array of event names that currently have at least one listener. */
  eventNames() {
    const all = [...this._shared.listeners.keys()];
    const withoutWildcard = all.filter((x) => x !== '*');
    return withoutWildcard;
  }

  /**
   * Returns the wrapped listener functions for the given event — these include
   * the auto-remove logic injected by `once()` and `prependOnceListener()`.
   * Use `rawListeners()` to get the original functions.
   */
  listeners<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
  ): EventListenerCombined<T_EventMap, T_Event>[] {
    const listeners = this._shared.listeners.get(event) || [];
    return listeners.map((x) => x.listener) as EventListenerCombined<T_EventMap, T_Event>[];
  }

  /** Returns the original listener functions, without any once-wrapper logic. */
  rawListeners<T_Event extends EventNamesCombined<T_EventMap>>(event: T_Event) {
    const listeners = this._shared.listeners.get(event) || [];
    return listeners.map((x) => x.listener) as EventListenerCombined<T_EventMap, T_Event>[];
  }

  detachSourceListeners(event?: EventNamesCombined<T_EventMap>): this {
    if (event != null) {
      const existing = this._shared.listeners.get(event) ?? [];
      const fromSource = existing.filter((x) => x.source === this);
      for (const container of fromSource) {
        const listener = container.listener as EventListenerCombined<
          T_EventMap,
          EventNamesCombined<T_EventMap>
        >;

        this._removeListener({
          event,
          listener,
        });
      }
    } else {
      //resource for all events
      const events = [...this._shared.listeners.keys()];
      events.forEach((event) => {
        this.detachSourceListeners(event);
      });
    }

    return this;
  }

  createEventSource(): EventSource<T_EventMap> {
    const clone = this._cloneRef();
    return clone;
  }

  //-------------------------------------------------------
  //-- utilities
  //-------------------------------------------------------
  private _cloneRef() {
    const clone = new TypedEventEmitter<T_EventMap>();
    clone._shared = this._shared;
    return clone;
  }

  private _handleListenerException(event: EventNamesCombined<T_EventMap>, err: unknown) {
    let shouldThrow = false;

    try {
      if (typeof this._shared.listenersErrorHandling === 'function') {
        this._shared.listenersErrorHandling(event, err);
      } else if (this._shared.listenersErrorHandling === 'throw') {
        shouldThrow = true;
      } else {
        const msg = `[TypedEventEmitter] listener error on "${event}":`;
        switch (this._shared.listenersErrorHandling) {
          case 'ignore':
            break;
          case 'log':
            console.log(msg, err);
            break;
          case 'warn':
            console.warn(msg, err);
            break;
          case 'error':
            console.error(msg, err);
            break;

          default:
            break;
        }
      }
    } catch {
      // this is enough!
    }

    // decided to rethrow !
    if (shouldThrow) {
      throw err;
    }
  }

  /** Allows only internal events. */
  private _emitInternal<Event extends EventNames<ReservedEvents<T_EventMap>>>(
    event: Event,
    ...args: EventParams<ReservedEvents<T_EventMap>, Event>
  ) {
    return this._emit({
      event,
      args,
      emitWildcardEvent: false,
    });
  }

  /** allows also internal events ("newListener", "removeListener", etc) */
  private _emit<T_Event extends EventNamesCombined<T_EventMap>>(params: {
    event: T_Event;
    args: EventParamsCombined<T_EventMap, T_Event>;
    emitWildcardEvent: boolean;
  }): boolean {
    const { event, args, emitWildcardEvent } = params;

    if (event === '*') {
      throw Error(
        `emitting wildcard event ("*") in not allowed. it's automatically sent to listeners on all user events`,
      );
    }

    //fire all wildcard ("*") listeners
    if (emitWildcardEvent) {
      // snapshot before iterating so mid-dispatch mutations don't affect this pass
      const containers = [...(this._shared.listeners.get('*') || [])];
      for (const container of containers) {
        const { listener, once } = container;
        try {
          listener(event, ...args);

          //remove if "once"
          if (once) {
            this._removeListener({
              event: '*',
              listener: listener as EventListenerCombined<T_EventMap, '*'>,
            });
          }
        } catch (err) {
          this._handleListenerException('*', err);
        }
      }
    }

    //now the actual listeners
    // snapshot before iterating so mid-dispatch mutations don't affect this pass
    const containers = [...(this._shared.listeners.get(event) || [])];
    if (containers.length === 0) {
      return false;
    }

    for (const container of containers) {
      const { listener, once } = container;
      try {
        listener(...args);
        //remove if "once"
        if (once) {
          this._removeListener({
            event: event,
            listener: listener as EventListenerCombined<T_EventMap, T_Event>,
          });
        }
      } catch (err) {
        this._handleListenerException(event, err);
      }
    }
    return true;
  }

  private _addListener<T_Event extends EventNamesCombined<T_EventMap>>(params: {
    event: T_Event;
    listener: EventListenerCombined<T_EventMap, T_Event>;
    postRemoved?: (event: EventNamesCombined<T_EventMap>) => void;
    once?: boolean;
    prepend?: boolean;
  }): this {
    const { event, listener, postRemoved, once = false, prepend = false } = params;

    //fire (internal event)
    if (!isReservedEventName(event)) {
      this._emitInternal('newListener', event, listener);
    }

    //get or create list
    let listeners = this._shared.listeners.get(event) ?? [];

    //add
    const container: Listener<T_EventMap> = {
      source: this,
      listener: listener,
      postRemoved: postRemoved,
      once: once,
    } as Listener<T_EventMap>;

    if (prepend) {
      listeners = [container, ...listeners];
    } else {
      listeners = [...listeners, container];
    }
    this._shared.listeners.set(event, listeners);

    const ignoreLimit = this._shared.maxListeners === 0 || this._shared.maxListeners === Infinity;
    if (!ignoreLimit && listeners.length > this._shared.maxListeners) {
      console.warn(
        `MaxListenersExceededWarning: Possible EventEmitter memory leak detected.\n${listeners.length} ${event} listeners added to [EventEmitter]. Use setMaxListeners() to increase limit`,
      );
    }
    return this;
  }
  //-------------------------------------------------------
  private _removeListener<T_Event extends EventNamesCombined<T_EventMap>>(params: {
    event: T_Event;
    listener: EventListenerCombined<T_EventMap, T_Event>;
  }): this {
    const { event, listener } = params;

    const containers = this._shared.listeners.get(event) ?? [];
    // first match goes
    // match against either the raw (for normal remove) or the wrapped (on once() remove with a wrapped listener)
    const idx = containers.findIndex((x) => x.listener === listener);
    if (idx !== -1) {
      const container = containers[idx];
      const postRemoved = container?.postRemoved;

      // splice is in place. no need to update the ref.
      containers.splice(idx, 1);

      //call postRemoved callback if exists
      postRemoved?.(event);

      //fire (internal event)
      if (!isReservedEventName(event)) {
        this._emitInternal('removeListener', event, listener);
      }
    }
    //prune if empty
    if (containers.length === 0) {
      this._shared.listeners.delete(event);
    }
    return this;
  }
}
