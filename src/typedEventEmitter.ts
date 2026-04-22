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

export class TypedEventEmitter<T_EventMap extends EventMap = EventMap> {
  private static _GLOBAL_MAX_LISTENERS = 10;

  private _listeners: ListenersMap<AllEvents<T_EventMap>> = new Map();
  private _maxListeners = TypedEventEmitter._GLOBAL_MAX_LISTENERS;
  private _errorHandling: ErrorHandlingType = 'warn';

  static set defaultMaxListeners(value: number) {
    this._GLOBAL_MAX_LISTENERS = value;
  }
  static get defaultMaxListeners() {
    return this._GLOBAL_MAX_LISTENERS;
  }

  setMaxListeners(n: number) {
    this._maxListeners = n;
    return this;
  }

  getMaxListeners() {
    return this._maxListeners;
  }

  //-------------------------------------------------------
  constructor(params?: ConstructionParams) {
    this._maxListeners = params?.maxListeners ?? TypedEventEmitter.defaultMaxListeners;
    this._errorHandling = params?.errorHandling ?? 'warn';
  }
  //-------------------------------------------------------

  setErrorHandling(e: ErrorHandlingType) {
    this._errorHandling = e;
    return this;
  }

  getErrorHandling() {
    return this._errorHandling;
  }

  emit<T_Event extends EventNames<T_EventMap>>(
    event: T_Event,
    ...args: Parameters<T_EventMap[T_Event]>
  ): boolean {
    // NOTE - user can only emit his events, not the internal ones ("newListener", "removeListener" ,etc)
    // thats why using [T_EventMap] and not [ALL_EVENTS<T_EventMap>]

    return this._emit(event, ...args);
  }

  subscribe<T_Event extends EventNames<AllEvents<T_EventMap>>>(
    event: T_Event,
    listener: EventListener<AllEvents<T_EventMap>, T_Event>,
  ): () => void {
    this._addListener({ event, listener });
    return () => this.off(event, listener);
  }

  on<T_Event extends EventNames<AllEvents<T_EventMap>>>(
    event: T_Event,
    listener: EventListener<AllEvents<T_EventMap>, T_Event>,
  ): this {
    return this._addListener({ event, listener });
  }

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

  addListener<T_Event extends EventNames<AllEvents<T_EventMap>>>(
    event: T_Event,
    listener: EventListener<AllEvents<T_EventMap>, T_Event>,
  ): this {
    return this.on(event, listener);
  }

  prependListener<T_Event extends EventNames<AllEvents<T_EventMap>>>(
    event: T_Event,
    listener: EventListener<AllEvents<T_EventMap>, T_Event>,
  ): this {
    return this._addListener({ event, listener, prepend: true });
  }

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

  off<T_Event extends EventNames<AllEvents<T_EventMap>>>(
    event: T_Event,
    listener: EventListener<AllEvents<T_EventMap>, T_Event>,
  ): this {
    return this._removeListener({ event, listener });
  }

  removeListener<T_Event extends EventNames<AllEvents<T_EventMap>>>(
    event: T_Event,
    listener: EventListener<AllEvents<T_EventMap>, T_Event>,
  ): this {
    return this._removeListener({ event, listener });
  }

  removeAllListeners(event?: EventNames<AllEvents<T_EventMap>>): this {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
    return this;
  }

  listeners<T_Event extends EventNames<AllEvents<T_EventMap>>>(
    event: T_Event,
  ): EventListener<AllEvents<T_EventMap>, T_Event>[] {
    //return the wrapped  - extra functionality is executed
    const listeners = this._listeners.get(event) || [];
    return listeners.map((x) => x.wrappedListener) as EventListener<
      AllEvents<T_EventMap>,
      T_Event
    >[];
  }

  rawListeners<T_Event extends EventNames<AllEvents<T_EventMap>>>(
    event: T_Event,
  ): EventListener<AllEvents<T_EventMap>, T_Event>[] {
    //return the raw - no extra functionality is executed
    const listeners = this._listeners.get(event) || [];
    return listeners.map((x) => x.rawListener) as EventListener<AllEvents<T_EventMap>, T_Event>[];
  }

  listenerCount(event: EventNames<AllEvents<T_EventMap>>): number {
    return this._listeners.get(event)?.length ?? 0;
  }

  eventNames() {
    return [...this._listeners.keys()];
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
