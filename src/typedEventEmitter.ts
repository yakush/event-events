import type {
  BaseEvents,
  constructionParams as ConstructionParams,
  ErrorHandlingType,
  EventListener,
  EventMap,
  EventNames,
  EventParams,
} from './types.js';

/**
 * container: { listener + metadata}
 */
type Listener<T_EventMap extends EventMap> = {
  wrappedListener: EventListener<T_EventMap, EventNames<T_EventMap>>;
  rawListener: EventListener<T_EventMap, EventNames<T_EventMap>>;
};

/** map: event=>{listener} */
type ListenersMap<T_EventMap extends EventMap> = Map<string, Array<Listener<T_EventMap>>>;

type AllEvents<T_EventMap extends EventMap> = T_EventMap & BaseEvents<T_EventMap>;

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
export class TypedEventEmitter<T_EventMap extends EventMap = EventMap> {
  private static _GLOBAL_MAX_LISTENERS = 10;

  private _listeners: ListenersMap<AllEvents<T_EventMap>> = new Map();
  private _maxListeners = TypedEventEmitter._GLOBAL_MAX_LISTENERS;
  private _errorHandling: ErrorHandlingType = 'warn';

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
    this._errorHandling = params?.errorHandling ?? 'warn';
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
  setErrorHandling(e: ErrorHandlingType) {
    this._errorHandling = e;
    return this;
  }

  /** Returns the current error handling mode. */
  getErrorHandling() {
    return this._errorHandling;
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
    ...args: Parameters<T_EventMap[T_Event]>
  ): boolean {
    return this._emit(event, ...args);
  }

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
  subscribe<T_Event extends EventNames<AllEvents<T_EventMap>>>(
    event: T_Event,
    listener: EventListener<AllEvents<T_EventMap>, T_Event>,
  ): () => void {
    this._addListener({ event, listener });
    return () => this.off(event, listener);
  }

  /**
   * Adds a listener for the given event. The same function can be added multiple
   * times and will be called once per registration. Returns `this` for chaining.
   */
  on<T_Event extends EventNames<AllEvents<T_EventMap>>>(
    event: T_Event,
    listener: EventListener<AllEvents<T_EventMap>, T_Event>,
  ): this {
    return this._addListener({ event, listener });
  }

  /**
   * Adds a one-time listener. It is automatically removed after the first time
   * the event is emitted. Returns `this` for chaining.
   */
  once<T_Event extends EventNames<AllEvents<T_EventMap>>>(
    event: T_Event,
    listener: EventListener<AllEvents<T_EventMap>, T_Event>,
  ): this {
    const wrappedListener = ((...args: Parameters<AllEvents<T_EventMap>[T_Event]>) => {
      this.off(event, wrappedListener);
      listener(...args);
    }) as EventListener<AllEvents<T_EventMap>, T_Event>;

    return this._addListener({ event, listener, wrappedListener });
  }

  /** Alias for `on()`. */
  addListener<T_Event extends EventNames<AllEvents<T_EventMap>>>(
    event: T_Event,
    listener: EventListener<AllEvents<T_EventMap>, T_Event>,
  ): this {
    return this.on(event, listener);
  }

  /**
   * Adds a listener at the front of the call queue so it is called before
   * any previously registered listeners. Returns `this` for chaining.
   */
  prependListener<T_Event extends EventNames<AllEvents<T_EventMap>>>(
    event: T_Event,
    listener: EventListener<AllEvents<T_EventMap>, T_Event>,
  ): this {
    return this._addListener({ event, listener, prepend: true });
  }

  /** Like `prependListener`, but auto-removes after the first emit. */
  prependOnceListener<T_Event extends EventNames<AllEvents<T_EventMap>>>(
    event: T_Event,
    listener: EventListener<AllEvents<T_EventMap>, T_Event>,
  ): this {
    const wrappedListener = ((...args: Parameters<AllEvents<T_EventMap>[T_Event]>) => {
      this.off(event, wrappedListener);
      listener(...args);
    }) as EventListener<AllEvents<T_EventMap>, T_Event>;

    return this._addListener({ event, listener, wrappedListener, prepend: true });
  }

  /**
   * Removes the first matching registration of `listener` for `event`.
   * If the same function was registered multiple times, only the first is removed.
   * Returns `this` for chaining.
   */
  off<T_Event extends EventNames<AllEvents<T_EventMap>>>(
    event: T_Event,
    listener: EventListener<AllEvents<T_EventMap>, T_Event>,
  ): this {
    return this._removeListener({ event, listener });
  }

  /** Alias for `off()`. */
  removeListener<T_Event extends EventNames<AllEvents<T_EventMap>>>(
    event: T_Event,
    listener: EventListener<AllEvents<T_EventMap>, T_Event>,
  ): this {
    return this._removeListener({ event, listener });
  }

  /**
   * Removes all listeners for a specific event, or all listeners for all events
   * if no event is specified. Returns `this` for chaining.
   */
  removeAllListeners(event?: EventNames<AllEvents<T_EventMap>>): this {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
    return this;
  }

  /** Returns the number of listeners registered for the given event. */
  listenerCount(event: EventNames<AllEvents<T_EventMap>>): number {
    return this._listeners.get(event)?.length ?? 0;
  }

  /** Returns an array of event names that currently have at least one listener. */
  eventNames() {
    return [...this._listeners.keys()];
  }

  /**
   * Returns the wrapped listener functions for the given event — these include
   * the auto-remove logic injected by `once()` and `prependOnceListener()`.
   * Use `rawListeners()` to get the original functions.
   */
  listeners<T_Event extends EventNames<AllEvents<T_EventMap>>>(
    event: T_Event,
  ): EventListener<AllEvents<T_EventMap>, T_Event>[] {
    const listeners = this._listeners.get(event) || [];
    return listeners.map((x) => x.wrappedListener) as EventListener<
      AllEvents<T_EventMap>,
      T_Event
    >[];
  }

  /** Returns the original listener functions, without any once-wrapper logic. */
  rawListeners<T_Event extends EventNames<AllEvents<T_EventMap>>>(
    event: T_Event,
  ): EventListener<AllEvents<T_EventMap>, T_Event>[] {
    const listeners = this._listeners.get(event) || [];
    return listeners.map((x) => x.rawListener) as EventListener<AllEvents<T_EventMap>, T_Event>[];
  }

  //-------------------------------------------------------
  //-- utilities
  //-------------------------------------------------------

  /** allows also internal events ("newListener", "removeListener", etc) */
  private _emit<T_Event extends EventNames<AllEvents<T_EventMap>>>(
    event: T_Event,
    ...args: Parameters<AllEvents<T_EventMap>[T_Event]>
  ): boolean {
    const listeners = this.listeners(event);
    if (listeners.length === 0) return false;

    for (const listener of listeners) {
      try {
        listener(...args);
      } catch (err) {
        //error handling according to set behaviour
        if (typeof this._errorHandling === 'function') {
          this._errorHandling(event, err);
        } else if (this._errorHandling === 'throw') {
          throw err;
        } else {
          const msg = `[TypedEventEmitter] listener error on "${event}":`;
          switch (this._errorHandling) {
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
      }
    }
    return true;
  }
  /** allows only internal events */
  private _emitInternal<Event extends EventNames<BaseEvents<T_EventMap>>>(
    event: Event,
    ...args: EventParams<BaseEvents<T_EventMap>, Event>
  ) {
    return this._emit(event, ...args);
  }

  private _addListener<T_Event extends EventNames<AllEvents<T_EventMap>>>(params: {
    event: T_Event;
    listener: EventListener<AllEvents<T_EventMap>, T_Event>;
    wrappedListener?: EventListener<AllEvents<T_EventMap>, T_Event>;
    prepend?: boolean;
  }): this {
    const { event, listener } = params;
    let { wrappedListener, prepend } = params;
    wrappedListener = wrappedListener ?? listener;
    prepend = prepend ?? false;

    //fire (internal event)
    // in _addListener, before firing:
    if (event !== 'newListener' && event !== 'removeListener') {
      this._emitInternal('newListener', event, listener);
    }

    //get or create list
    let listeners = this._listeners.get(event);
    if (listeners == null) {
      listeners = [];
    }

    //add
    const container = {
      rawListener: listener,
      wrappedListener: wrappedListener,
    } as Listener<AllEvents<T_EventMap>>;

    if (prepend) {
      listeners = [container, ...listeners];
    } else {
      listeners = [...listeners, container];
    }
    this._listeners.set(event, listeners);

    const ignoreLimit = this._maxListeners === 0 || this._maxListeners === Infinity;
    if (!ignoreLimit && listeners.length > this._maxListeners) {
      console.warn(`
        MaxListenersExceededWarning: Possible EventEmitter memory leak detected.\n
        ${listeners.length} ${event} listeners added to [EventEmitter]. Use setMaxListeners() to increase limit
        `);
    }
    return this;
  }
  //-------------------------------------------------------
  private _removeListener<T_Event extends EventNames<AllEvents<T_EventMap>>>(params: {
    event: T_Event;
    listener: EventListener<AllEvents<T_EventMap>, T_Event>;
  }): this {
    const { event, listener } = params;

    const listeners = this._listeners.get(event) ?? [];
    // first match goes
    // match against either the raw (for normal remove) or the wrapped (on once() remove with a wrapped listener)
    const idx = listeners.findIndex(
      (x) => x.rawListener === listener || x.wrappedListener === listener,
    );
    if (idx != -1) {
      // splice is in place. no need to update the ref.
      listeners.splice(idx, 1);

      //fire (internal event)
      if (event !== 'newListener' && event !== 'removeListener') {
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
