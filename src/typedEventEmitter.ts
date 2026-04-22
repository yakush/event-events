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
  ListenersErrorHandlingType,
  EventListener,
  EventMap,
  EventNames,
  EventParams,
} from './types.js';

/**
 * container: { listener + metadata}
 */
type Listener<T_EventMap extends EventMap = EventMap> = {
  wrappedListener: EventListener<T_EventMap, EventNames<T_EventMap>>;
  rawListener: EventListener<T_EventMap, EventNames<T_EventMap>>;
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

  /**
   * map: event -> (array:{event container}) \
   * including the internal events
   */
  private _listeners: Map<string, Array<Listener<T_EventMap>>> = new Map();

  private _wildcardListeners: Array<
    Listener<{ '*': (event: EventNames<T_EventMap>, ...args: any[]) => void }>
  > = [];

  // private _wildcardListeners: Array<Listener<{}>>
  private _maxListeners = TypedEventEmitter._GLOBAL_MAX_LISTENERS;
  private _listenersErrorHandling: ListenersErrorHandlingType = 'warn';

  /** Default max listeners for all new instances. Set to `0` or `Infinity` to disable. */
  static set defaultMaxListeners(value: number) {
    this._GLOBAL_MAX_LISTENERS = value;
  }
  static get defaultMaxListeners() {
    return this._GLOBAL_MAX_LISTENERS;
  }

  /** Sets the max listener threshold for this instance. Returns `this` for chaining. */
  setMaxListeners(n: number) {
    this._maxListeners = n;
    return this;
  }

  /** Returns the current max listener threshold for this instance. */
  getMaxListeners() {
    return this._maxListeners;
  }

  //-------------------------------------------------------
  constructor(params?: ConstructionParams) {
    this._maxListeners = params?.maxListeners ?? TypedEventEmitter.defaultMaxListeners;
    this._listenersErrorHandling = params?.listenersErrorHandling ?? 'warn';
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
    this._listenersErrorHandling = e;
    return this;
  }

  /** Returns the current error handling mode. */
  getListenersErrorHandling() {
    return this._listenersErrorHandling;
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
    const remove = () => this._removeListener({ event, listener });
    const wrappedListener = ((...args: EventParamsCombined<T_EventMap, T_Event>) => {
      remove();
      listener(...args);
    }) as EventListenerCombined<T_EventMap, T_Event>;

    return this._addListener({ event, listener, wrappedListener });
  }

  subscribeOnce<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
    listener: EventListenerCombined<T_EventMap, T_Event>,
  ): () => void {
    const remove = () => this._removeListener({ event, listener });
    const wrappedListener = ((...args: EventParamsCombined<T_EventMap, T_Event>) => {
      remove();
      listener(...args);
    }) as EventListenerCombined<T_EventMap, T_Event>;

    this._addListener({ event, listener, wrappedListener });
    return remove;
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
    const remove = () => this._removeListener({ event, listener });

    const wrappedListener = ((...args: EventParamsCombined<T_EventMap, T_Event>) => {
      remove();
      listener(...args);
    }) as EventListenerCombined<T_EventMap, T_Event>;

    return this._addListener({ event, listener, wrappedListener, prepend: true });
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

      // premature abortion
      if (signal?.aborted) {
        reject(new Error('aborted'));
        return;
      }

      // handle bort
      const onAbort = () => {
        unsubscribe();
        reject(new Error('aborted'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });

      // register event (once)
      const listener = ((...args: EventParamsCombined<T_EventMap, T_Event>) => {
        signal?.removeEventListener('abort', onAbort);
        resolve(args);
      }) as EventListenerCombined<T_EventMap, T_Event>;

      const unsubscribe = this.subscribeOnce(event, listener);
    });
  }

  removeAllListeners(event?: EventNamesCombined<T_EventMap>): this {
    if (event === '*') {
      this._wildcardListeners = [];
    } else if (event) {
      this._listeners.delete(event);
    } else {
      this._wildcardListeners = [];
      this._listeners.clear();
    }
    return this;
  }

  listenerCount(event?: EventNamesCombined<T_EventMap>): number {
    if (event === '*') {
      return this._wildcardListeners.length;
    } else if (event) {
      return this._listeners.get(event)?.length ?? 0;
    } else {
      let count = this._wildcardListeners.length;
      this._listeners.forEach((group) => {
        count += group.length;
      });
      return count;
    }
  }

  eventNames() {
    return [...this._listeners.keys()];
  }

  listeners<T_Event extends EventNamesCombined<T_EventMap>>(
    event: T_Event,
  ): EventListenerCombined<T_EventMap, T_Event>[] {
    if (event === '*') {
      const listeners = this._wildcardListeners;
      return listeners.map((x) => x.wrappedListener) as EventListenerCombined<
        T_EventMap,
        T_Event
      >[];
    }

    const listeners = this._listeners.get(event) || [];
    return listeners.map((x) => x.wrappedListener) as EventListenerCombined<T_EventMap, T_Event>[];
  }

  rawListeners<T_Event extends EventNamesCombined<T_EventMap>>(event: T_Event) {
    if (event === '*') {
      const listeners = this._wildcardListeners;
      return listeners.map((x) => x.rawListener) as EventListenerCombined<T_EventMap, T_Event>[];
    }

    const listeners = this._listeners.get(event) || [];
    return listeners.map((x) => x.rawListener) as EventListenerCombined<T_EventMap, T_Event>[];
  }

  asEventSource(): EventSource<T_EventMap> {
    return this;
  }

  //-------------------------------------------------------
  //-- utilities
  //-------------------------------------------------------
  private _handleListenerException(event: EventNamesCombined<T_EventMap>, err: unknown) {
    let shouldThrow = false;

    try {
      if (typeof this._listenersErrorHandling === 'function') {
        this._listenersErrorHandling(event, err);
      } else if (this._listenersErrorHandling === 'throw') {
        shouldThrow = true;
      } else {
        const msg = `[TypedEventEmitter] listener error on "${event}":`;
        switch (this._listenersErrorHandling) {
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
      const listeners = this._wildcardListeners.map((x) => x.wrappedListener);

      for (const listener of listeners) {
        try {
          listener(event, ...args);
        } catch (err) {
          this._handleListenerException('*', err);
        }
      }
    }

    //now the actual listeners
    const listeners = this.listeners(event);
    if (listeners.length === 0) {
      return false;
    }

    for (const listener of listeners) {
      try {
        listener(...args);
      } catch (err) {
        this._handleListenerException(event, err);
      }
    }
    return true;
  }

  private _addListener<T_Event extends EventNamesCombined<T_EventMap>>(params: {
    event: T_Event;
    listener: EventListenerCombined<T_EventMap, T_Event>;
    wrappedListener?: EventListenerCombined<T_EventMap, T_Event>;
    prepend?: boolean;
  }): this {
    const { event, listener } = params;
    let { wrappedListener, prepend } = params;
    wrappedListener = wrappedListener ?? listener;
    prepend = prepend ?? false;

    //fire (internal event)
    if (!isReservedEventName(event)) {
      this._emitInternal('newListener', event, listener);
    }

    //-- ITS THE WILDCARD EVENTS

    if (event === '*') {
      //add
      const container = {
        rawListener: listener,
        wrappedListener: wrappedListener,
      };

      if (prepend) {
        this._wildcardListeners = [container, ...this._wildcardListeners];
      } else {
        this._wildcardListeners = [...this._wildcardListeners, container];
      }
      return this;
    }

    //-- ITS A REGULAR EVENT

    //get or create list
    let listeners = this._listeners.get(event);
    if (listeners == null) {
      listeners = [];
    }

    //add
    const container = {
      rawListener: listener,
      wrappedListener: wrappedListener,
    } as Listener<T_EventMap>;

    if (prepend) {
      listeners = [container, ...listeners];
    } else {
      listeners = [...listeners, container];
    }
    this._listeners.set(event, listeners);

    const ignoreLimit = this._maxListeners === 0 || this._maxListeners === Infinity;
    if (!ignoreLimit && listeners.length > this._maxListeners) {
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

    //-- ITS THE WILDCARD EVENTS

    if (event === '*') {
      const idx = this._wildcardListeners.findIndex(
        (x) => x.rawListener === listener || x.wrappedListener === listener,
      );
      if (idx !== -1) {
        // splice is in place. no need to update the ref.
        this._wildcardListeners.splice(idx, 1);
      }

      return this;
    }

    //-- ITS A REGULAR EVENT

    const listeners = this._listeners.get(event) ?? [];
    // first match goes
    // match against either the raw (for normal remove) or the wrapped (on once() remove with a wrapped listener)
    const idx = listeners.findIndex(
      (x) => x.rawListener === listener || x.wrappedListener === listener,
    );
    if (idx !== -1) {
      // splice is in place. no need to update the ref.
      listeners.splice(idx, 1);

      //fire (internal event)
      if (!isReservedEventName(event)) {
        this._emitInternal('removeListener', event, listener);
      }
    }
    //prune if empty
    if (listeners.length === 0) {
      this._listeners.delete(event);
    }
    return this;
  }
}
