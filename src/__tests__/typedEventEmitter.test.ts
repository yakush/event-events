import { afterEach, describe, expect, it, vi } from 'vitest';
import { TypedEventEmitter } from '../typedEventEmitter.js';

type TestEvents = {
  greet: (name: string) => void;
  count: (n: number) => void;
  empty: () => void;
};

describe('TypedEventEmitter', () => {
  // -------------------------------------------------------
  // 1. on / addListener — fire, unregister, no reaction
  // -------------------------------------------------------
  describe('event names', () => {
    it('return all events that are registered to except "*"', () => {
      const emitter = new TypedEventEmitter<TestEvents>();

      const f = vi.fn();

      emitter.on('greet', f);
      emitter.on('count', f);
      emitter.on('count', f);
      emitter.on('*', f);
      emitter.on('newListener', f);
      expect(emitter.eventNames()).toEqual(['greet', 'count', 'newListener']);

      emitter.off('greet', f);
      emitter.off('count', f);
      expect(emitter.eventNames()).toEqual(['count', 'newListener']);

      emitter.off('newListener', f);
      expect(emitter.eventNames()).toEqual(['count']);

      emitter.off('count', f);
      expect(emitter.eventNames()).toEqual([]);
    });
  });
  describe('on / addListener', () => {
    it('calls listener each time the event is emitted', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const calls: string[] = [];

      emitter.on('greet', (name) => calls.push(name));
      emitter.emit('greet', 'Alice');
      emitter.emit('greet', 'Bob');

      expect(calls).toEqual(['Alice', 'Bob']);
    });

    it('addListener behaves identically to on', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const calls: string[] = [];

      emitter.addListener('greet', (name) => calls.push(name));
      emitter.emit('greet', 'Alice');

      expect(calls).toEqual(['Alice']);
    });

    it('stops calling listener after off', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const calls: string[] = [];
      const listener = (name: string) => calls.push(name);

      emitter.on('greet', listener);
      emitter.emit('greet', 'Alice');
      emitter.off('greet', listener);
      emitter.emit('greet', 'Bob');

      expect(calls).toEqual(['Alice']);
    });

    it('returns false when emitting with no listeners', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      expect(emitter.emit('greet', 'Alice')).toBe(false);
    });

    it('returns true when at least one listener is called', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      emitter.on('greet', () => {});
      expect(emitter.emit('greet', 'Alice')).toBe(true);
    });
  });

  // -------------------------------------------------------
  // 2. subscribe — returns unsubscribe fn
  // -------------------------------------------------------
  describe('subscribe', () => {
    it('calls listener when subscribed', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const calls: string[] = [];

      emitter.subscribe('greet', (name) => calls.push(name));
      emitter.emit('greet', 'Alice');

      expect(calls).toEqual(['Alice']);
    });

    it('stops calling listener after calling the returned unsubscribe fn', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const calls: string[] = [];

      const unsubscribe = emitter.subscribe('greet', (name) => calls.push(name));
      emitter.emit('greet', 'Alice');
      unsubscribe();
      emitter.emit('greet', 'Bob');

      expect(calls).toEqual(['Alice']);
    });

    it('calling unsubscribe twice does not throw', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const unsubscribe = emitter.subscribe('greet', () => {});
      expect(() => {
        unsubscribe();
        unsubscribe();
      }).not.toThrow();
    });
  });

  // -------------------------------------------------------
  // 3. subscribeOnce — fires once, returns unsubscribe fn
  // -------------------------------------------------------
  describe('subscribeOnce', () => {
    it('calls listener on first emit then auto-removes', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const calls: string[] = [];

      emitter.subscribeOnce('greet', (name) => calls.push(name));
      emitter.emit('greet', 'Alice');
      emitter.emit('greet', 'Bob');

      expect(calls).toEqual(['Alice']);
    });

    it('calling the returned unsubscribe fn before emit prevents the listener from ever firing', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const calls: string[] = [];

      const unsubscribe = emitter.subscribeOnce('greet', (name) => calls.push(name));
      unsubscribe();
      emitter.emit('greet', 'Alice');

      expect(calls).toEqual([]);
    });

    it('calling unsubscribe after the listener already fired does not throw', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const unsubscribe = emitter.subscribeOnce('greet', () => {});
      emitter.emit('greet', 'Alice');
      expect(() => {
        unsubscribe();
      }).not.toThrow();
    });

    it('calling unsubscribe twice does not throw', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const unsubscribe = emitter.subscribeOnce('greet', () => {});
      expect(() => {
        unsubscribe();
        unsubscribe();
      }).not.toThrow();
    });
  });

  // -------------------------------------------------------
  // 4. multiple events — only correct listeners triggered
  // -------------------------------------------------------
  describe('event isolation', () => {
    it('does not call listeners of other events', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const greetCalls: string[] = [];
      const countCalls: number[] = [];

      emitter.on('greet', (name) => greetCalls.push(name));
      emitter.on('count', (n) => countCalls.push(n));

      emitter.emit('greet', 'Alice');
      emitter.emit('count', 42);

      expect(greetCalls).toEqual(['Alice']);
      expect(countCalls).toEqual([42]);
    });

    it('emitting one event does not trigger listeners of another', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const countListener = vi.fn();

      emitter.on('count', countListener);
      emitter.emit('greet', 'Alice');

      expect(countListener).not.toHaveBeenCalled();
    });

    it('multiple listeners on the same event all get called', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const a = vi.fn();
      const b = vi.fn();
      const c = vi.fn();

      emitter.on('greet', a);
      emitter.on('greet', b);
      emitter.on('greet', c);
      emitter.emit('greet', 'Alice');

      expect(a).toHaveBeenCalledWith('Alice');
      expect(b).toHaveBeenCalledWith('Alice');
      expect(c).toHaveBeenCalledWith('Alice');
    });
  });

  // -------------------------------------------------------
  // 4. exceeded max listeners (default = 10)
  // -------------------------------------------------------
  describe('max listeners warning', () => {
    it('warns when listener count exceeds default max (10)', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      for (let i = 0; i <= 10; i++) {
        emitter.on('greet', () => {});
      }

      expect(warn).toHaveBeenCalledOnce();
      warn.mockRestore();
    });

    it('does not warn when listener count is exactly at the limit', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      for (let i = 0; i < 10; i++) {
        emitter.on('greet', () => {});
      }

      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  // -------------------------------------------------------
  // 5. exceeded max — defaultMaxListeners changed
  // -------------------------------------------------------
  describe('defaultMaxListeners', () => {
    const original = TypedEventEmitter.defaultMaxListeners;

    afterEach(() => {
      TypedEventEmitter.defaultMaxListeners = original;
    });

    it('new instances pick up the changed default', () => {
      TypedEventEmitter.defaultMaxListeners = 3;
      const emitter = new TypedEventEmitter<TestEvents>();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      for (let i = 0; i <= 3; i++) {
        emitter.on('greet', () => {});
      }

      expect(warn).toHaveBeenCalledOnce();
      warn.mockRestore();
    });

    it('does not warn below the custom default', () => {
      TypedEventEmitter.defaultMaxListeners = 3;
      const emitter = new TypedEventEmitter<TestEvents>();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      for (let i = 0; i < 3; i++) {
        emitter.on('greet', () => {});
      }

      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  // -------------------------------------------------------
  // 6. exceeded max — instance setMaxListeners
  // -------------------------------------------------------
  describe('setMaxListeners / getMaxListeners', () => {
    it('warns when instance limit is exceeded', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      emitter.setMaxListeners(3);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      for (let i = 0; i <= 3; i++) {
        emitter.on('greet', () => {});
      }

      expect(warn).toHaveBeenCalledOnce();
      warn.mockRestore();
    });

    it('getMaxListeners returns the current instance limit', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      emitter.setMaxListeners(5);
      expect(emitter.getMaxListeners()).toBe(5);
    });

    it('instance limit is independent of other instances', () => {
      const a = new TypedEventEmitter<TestEvents>();
      const b = new TypedEventEmitter<TestEvents>();
      a.setMaxListeners(2);

      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // b should still use default (10), no warn at 3 listeners
      for (let i = 0; i < 3; i++) {
        b.on('greet', () => {});
      }

      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  // -------------------------------------------------------
  // 7. no warning when limit is 0 or Infinity
  // -------------------------------------------------------
  describe('unlimited listeners (0 / Infinity)', () => {
    it('does not warn with setMaxListeners(0)', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      emitter.setMaxListeners(0);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      for (let i = 0; i < 100; i++) {
        emitter.on('greet', () => {});
      }

      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('does not warn with setMaxListeners(Infinity)', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      emitter.setMaxListeners(Infinity);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      for (let i = 0; i < 100; i++) {
        emitter.on('greet', () => {});
      }

      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  // -------------------------------------------------------
  // 8. newListener / removeListener internal events
  // -------------------------------------------------------
  describe('newListener / removeListener events', () => {
    it('fires newListener when a user listener is added', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const log: string[] = [];

      emitter.on('newListener', (event) => log.push(`added:${event}`));
      emitter.on('greet', () => {});
      emitter.on('count', () => {});

      expect(log).toEqual(['added:greet', 'added:count']);
    });

    it('fires removeListener when a user listener is removed', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const log: string[] = [];
      const listener = () => {};

      emitter.on('removeListener', (event) => log.push(`removed:${event}`));
      emitter.on('greet', listener);
      emitter.off('greet', listener);

      expect(log).toEqual(['removed:greet']);
    });

    it('does not fire removeListener when listener was not found', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const removed = vi.fn();

      emitter.on('removeListener', removed);
      emitter.off('greet', () => {});

      expect(removed).not.toHaveBeenCalled();
    });

    it('subscribing to newListener does not self-trigger', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler = vi.fn();

      emitter.on('newListener', handler);

      // the registration of 'newListener' itself should NOT have fired handler
      expect(handler).not.toHaveBeenCalled();
    });

    it('unsubscribing from removeListener does not self-trigger', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler = vi.fn();

      emitter.on('removeListener', handler);
      emitter.off('removeListener', handler);

      // the removal of 'removeListener' itself should NOT have fired handler
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------
  // 9. error handling modes
  // -------------------------------------------------------
  describe('error handling', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const throwing = () => {
      throw new Error('boom');
    };

    it('default mode is warn', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      expect(emitter.getErrorHandling()).toBe('warn');
    });

    it('warn mode — calls console.warn and continues', () => {
      const emitter = new TypedEventEmitter<TestEvents>({ errorHandling: 'warn' });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const next = vi.fn();

      emitter.on('greet', throwing);
      emitter.on('greet', next);
      expect(() => emitter.emit('greet', 'Alice')).not.toThrow();

      expect(warn).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith('Alice');
    });

    it('log mode — calls console.log and continues', () => {
      const emitter = new TypedEventEmitter<TestEvents>({ errorHandling: 'log' });
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const next = vi.fn();

      emitter.on('greet', throwing);
      emitter.on('greet', next);
      emitter.emit('greet', 'Alice');

      expect(log).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalled();
    });

    it('error mode — calls console.error and continues', () => {
      const emitter = new TypedEventEmitter<TestEvents>({ errorHandling: 'error' });
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const next = vi.fn();

      emitter.on('greet', throwing);
      emitter.on('greet', next);
      emitter.emit('greet', 'Alice');

      expect(error).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalled();
    });

    it('ignore mode — no output, no throw, continues', () => {
      const emitter = new TypedEventEmitter<TestEvents>({ errorHandling: 'ignore' });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const next = vi.fn();

      emitter.on('greet', throwing);
      emitter.on('greet', next);
      expect(() => emitter.emit('greet', 'Alice')).not.toThrow();

      expect(warn).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('throw mode — rethrows and stops remaining listeners', () => {
      const emitter = new TypedEventEmitter<TestEvents>({ errorHandling: 'throw' });
      const next = vi.fn();

      emitter.on('greet', throwing);
      emitter.on('greet', next);

      expect(() => emitter.emit('greet', 'Alice')).toThrow('boom');
      expect(next).not.toHaveBeenCalled();
    });

    it('custom handler — called with event name and error', () => {
      const handler = vi.fn();
      const emitter = new TypedEventEmitter<TestEvents>({ errorHandling: handler });
      const next = vi.fn();
      const err = new Error('boom');

      emitter.on('greet', () => {
        throw err;
      });
      emitter.on('greet', next);
      emitter.emit('greet', 'Alice');

      expect(handler).toHaveBeenCalledWith('greet', err);
      expect(next).toHaveBeenCalled();
    });

    it('setErrorHandling changes mode on existing instance', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      emitter.setErrorHandling('ignore');
      expect(emitter.getErrorHandling()).toBe('ignore');
    });

    it('constructor maxListeners option is respected', () => {
      const emitter = new TypedEventEmitter<TestEvents>({ maxListeners: 2 });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      emitter.on('greet', () => {});
      emitter.on('greet', () => {});
      expect(warn).not.toHaveBeenCalled();

      emitter.on('greet', () => {});
      expect(warn).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------
  // 10. wildcard listeners ('*')
  // -------------------------------------------------------
  describe('wildcard listeners', () => {
    it('wildcard listener is called on every user event', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const calls: string[] = [];

      emitter.on('*', (event) => calls.push(event));
      emitter.emit('greet', 'Alice');
      emitter.emit('count', 42);

      expect(calls).toEqual(['greet', 'count']);
    });

    it('wildcard listener receives the event name and args', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler = vi.fn();

      emitter.on('*', handler);
      emitter.emit('greet', 'Alice');

      expect(handler).toHaveBeenCalledWith('greet', 'Alice');
    });

    it('wildcard listener fires before regular listeners', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const order: string[] = [];

      emitter.on('*', () => order.push('wildcard'));
      emitter.on('greet', () => order.push('regular'));
      emitter.emit('greet', 'Alice');

      expect(order).toEqual(['wildcard', 'regular']);
    });

    it('wildcard listener does not fire on internal events (newListener, removeListener)', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler = vi.fn();

      emitter.on('*', handler);
      // adding and removing a listener triggers internal events — wildcard must not fire for those
      const listener = () => {};
      emitter.on('greet', listener);
      emitter.off('greet', listener);

      expect(handler).not.toHaveBeenCalled();
    });

    it('emitting "*" directly throws', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      expect(() => emitter.emit('*' as any)).toThrow();
    });

    it('off removes the wildcard listener', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler = vi.fn();

      emitter.on('*', handler);
      emitter.off('*', handler);
      emitter.emit('greet', 'Alice');

      expect(handler).not.toHaveBeenCalled();
    });

    it('once("*") fires only on the first emit then auto-removes', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler = vi.fn();

      emitter.once('*', handler);
      emitter.emit('greet', 'Alice');
      emitter.emit('greet', 'Bob');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith('greet', 'Alice');
    });

    it('subscribe("*") returns an unsubscribe fn that removes the wildcard listener', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler = vi.fn();

      const unsub = emitter.subscribe('*', handler);
      emitter.emit('greet', 'Alice');
      unsub();
      emitter.emit('greet', 'Bob');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('removeAllListeners("*") clears all wildcard listeners', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler = vi.fn();

      emitter.on('*', handler);
      emitter.removeAllListeners('*');
      emitter.emit('greet', 'Alice');

      expect(handler).not.toHaveBeenCalled();
    });

    it('removeAllListeners() with no arg clears wildcard listeners too', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler = vi.fn();

      emitter.on('*', handler);
      emitter.removeAllListeners();
      emitter.emit('greet', 'Alice');

      expect(handler).not.toHaveBeenCalled();
    });

    it('listenerCount("*") returns the wildcard listener count', () => {
      const emitter = new TypedEventEmitter<TestEvents>();

      emitter.on('*', () => {});
      emitter.on('*', () => {});

      expect(emitter.listenerCount('*')).toBe(2);
    });

    it('rawListeners("*") returns the wildcard listeners', () => {
      const emitter = new TypedEventEmitter<TestEvents>();

      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      emitter.on('*', listener1);
      emitter.on('*', listener2);
      emitter.on('count', listener3);

      expect(emitter.rawListeners('*')).toEqual([listener1, listener2]);
    });
  });

  // -------------------------------------------------------
  // 11. waitFor
  // -------------------------------------------------------
  describe('async', () => {
    it('resolves with the event args when the event fires', async () => {
      const emitter = new TypedEventEmitter<TestEvents>();

      const promise = emitter.waitFor('greet');
      emitter.emit('greet', 'Alice');

      expect(await promise).toEqual(['Alice']);
    });

    it('resolves only once — listener is removed after the first emit', async () => {
      const emitter = new TypedEventEmitter<TestEvents>();

      const promise = emitter.waitFor('greet');
      emitter.emit('greet', 'Alice');
      await promise;

      expect(emitter.listenerCount('greet')).toBe(0);
    });

    it('rejects when the AbortSignal is aborted', async () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const controller = new AbortController();

      const promise = emitter.waitFor('greet', { signal: controller.signal });
      controller.abort();

      await expect(promise).rejects.toThrow('aborted');
    });

    it('rejects immediately when given an already-aborted signal', async () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const controller = new AbortController();
      controller.abort();

      const promise = emitter.waitFor('greet', { signal: controller.signal });

      await expect(promise).rejects.toThrow('aborted');
    });

    it('aborting after event fires does not double-reject', async () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const controller = new AbortController();

      const promise = emitter.waitFor('greet', { signal: controller.signal });
      emitter.emit('greet', 'Alice');
      await promise;

      // aborting after resolution should have no effect
      expect(() => { controller.abort(); }).not.toThrow();
    });

    it('aborting removes the listener', async () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const controller = new AbortController();

      const promise = emitter.waitFor('greet', { signal: controller.signal });
      controller.abort();

      await promise.catch(() => {});
      expect(emitter.listenerCount('greet')).toBe(0);
    });
  });
});
