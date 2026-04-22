import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  // 3. multiple events — only correct listeners triggered
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
    it('fires newListener before a listener is added', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const log: string[] = [];

      emitter.on('newListener', (event) => log.push(`added:${event}`));
      emitter.on('greet', () => {});
      emitter.on('count', () => {});

      expect(log).toEqual(['added:greet', 'added:count']);
    });

    it('fires removeListener after a listener is removed', () => {
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
      emitter.off('greet', () => {}); // nothing registered, nothing to remove

      expect(removed).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------
  // 9. exceptions — logged, next listeners still called
  // -------------------------------------------------------
  describe('listener exceptions', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('logs the error and continues calling remaining listeners', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const calls: string[] = [];

      emitter.on('greet', () => {
        throw new Error('boom');
      });
      emitter.on('greet', (name) => calls.push(name));

      expect(() => emitter.emit('greet', 'Alice')).not.toThrow();
      expect(calls).toEqual(['Alice']);
      expect(console.error).toHaveBeenCalledOnce();
    });

    it('logs an error per throwing listener', () => {
      const emitter = new TypedEventEmitter<TestEvents>();

      emitter.on('greet', () => {
        throw new Error('first');
      });
      emitter.on('greet', () => {
        throw new Error('second');
      });

      emitter.emit('greet', 'Alice');
      expect(console.error).toHaveBeenCalledTimes(2);
    });
  });
});
