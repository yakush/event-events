import type { DefaultEventMap, EventListener, EventMap, EventNames } from './types.js';

/**
 * container: { listener + metadata}
 */
type Listener<T_EventMap extends EventMap> = {
  wrappedListener: EventListener<T_EventMap, EventNames<T_EventMap>>;
  rawListener: EventListener<T_EventMap, EventNames<T_EventMap>>;
};

/** map: event=>{listener} */
type ListenersMap<T_EventMap extends EventMap> = Map<string, Array<Listener<T_EventMap>>>;

export class TypedEventEmitter<T_EventMap extends EventMap = DefaultEventMap> {
  private _listeners: ListenersMap<T_EventMap> = new Map();

  emit<T_Event extends EventNames<T_EventMap>>(
    event: T_Event,
    ...args: Parameters<T_EventMap[T_Event]>
  ): boolean {
    const listeners = this.listeners(event);
    if (listeners.length === 0) return false;

    for (const listener of listeners) {
      try {
        listener(...args);
      } catch (err) {
        console.error(`[TypedEventEmitter] listener error on "${event}":`, err);
      }
    }

    return true;
  }

  subscribe<T_Event extends EventNames<T_EventMap>>(
    event: T_Event,
    listener: EventListener<T_EventMap, T_Event>,
  ): () => void {
    this._addListener({ event, listener });
    return () => this.off(event, listener);
  }

  on<T_Event extends EventNames<T_EventMap>>(
    event: T_Event,
    listener: EventListener<T_EventMap, T_Event>,
  ): this {
    return this._addListener({ event, listener });
  }

  once<T_Event extends EventNames<T_EventMap>>(
    event: T_Event,
    listener: EventListener<T_EventMap, T_Event>,
  ): this {
    const wrappedListener = ((...args: Parameters<T_EventMap[T_Event]>) => {
      this.off(event, wrappedListener);
      listener(...args);
    }) as EventListener<T_EventMap, T_Event>;

    return this._addListener({ event, listener, wrappedListener });
  }

  addListener<T_Event extends EventNames<T_EventMap>>(
    event: T_Event,
    listener: EventListener<T_EventMap, T_Event>,
  ): this {
    return this.on(event, listener);
  }

  prependListener<T_Event extends EventNames<T_EventMap>>(
    event: T_Event,
    listener: EventListener<T_EventMap, T_Event>,
  ): this {
    return this._addListener({ event, listener, perpend: true });
  }

  prependOnceListener<T_Event extends EventNames<T_EventMap>>(
    event: T_Event,
    listener: EventListener<T_EventMap, T_Event>,
  ): this {
    const wrappedListener = ((...args: Parameters<T_EventMap[T_Event]>) => {
      this.off(event, wrappedListener);
      listener(...args);
    }) as EventListener<T_EventMap, T_Event>;

    return this._addListener({ event, listener, wrappedListener, perpend: true });
  }

  off<T_Event extends EventNames<T_EventMap>>(
    event: T_Event,
    listener: EventListener<T_EventMap, T_Event>,
  ): this {
    const listeners = this._listeners.get(event) ?? [];
    // first match goes
    // match against either the raw (for normal remove) or the wrapped (on once() remove with a wrapped listener)
    const idx = listeners.findIndex(
      (x) => x.rawListener === listener || x.wrappedListener === listener,
    );
    if (idx != -1) {
      // splice is in place. no need to update the ref.
      listeners.splice(idx, 1);
    }
    //prune if empty
    if (listeners.length === 0) {
      this._listeners.delete(event);
    }
    return this;
  }

  removeAllListeners(event?: EventNames<T_EventMap>): this {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
    return this;
  }

  listeners<T_Event extends EventNames<T_EventMap>>(
    event: T_Event,
  ): EventListener<T_EventMap, T_Event>[] {
    //return the wrapped  - extra functionality is executed
    const listeners = this._listeners.get(event) || [];
    return listeners.map((x) => x.wrappedListener) as EventListener<T_EventMap, T_Event>[];
  }

  rawListeners<T_Event extends EventNames<T_EventMap>>(
    event: T_Event,
  ): EventListener<T_EventMap, T_Event>[] {
    //return the raw - no extra functionality is executed
    const listeners = this._listeners.get(event) || [];
    return listeners.map((x) => x.rawListener) as EventListener<T_EventMap, T_Event>[];
  }

  listenerCount(event: EventNames<T_EventMap>): number {
    return this._listeners.get(event)?.length ?? 0;
  }

  //-------------------------------------------------------
  //-- utilities
  //-------------------------------------------------------
  private _addListener<T_Event extends EventNames<T_EventMap>>(params: {
    event: T_Event;
    listener: EventListener<T_EventMap, T_Event>;
    wrappedListener?: EventListener<T_EventMap, T_Event>;
    perpend?: boolean;
  }): this {
    const { event, listener } = params;
    let { wrappedListener, perpend } = params;
    wrappedListener = wrappedListener ?? listener;
    perpend = perpend ?? false;

    //get or create list
    let listeners = this._listeners.get(event);
    if (listeners == null) {
      listeners = [];
    }

    //add
    const container: Listener<T_EventMap> = {
      rawListener: listener,
      wrappedListener: wrappedListener,
    };

    if (perpend) {
      listeners = [container, ...listeners];
    } else {
      listeners = [...listeners, container];
    }
    this._listeners.set(event, listeners);

    return this;
  }
}
