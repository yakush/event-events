import type { EventListener, EventMap, EventNames, EventParams } from '../types.js';

export const RESERVED_EVENTS = ['newListener', 'removeListener', '*'] as const;

export type ReservedEvents<T_EventMap extends EventMap = EventMap> = {
  newListener: (event: EventNames<T_EventMap>, listener: (...args: any[]) => void) => void;
  removeListener: (event: EventNames<T_EventMap>, listener: (...args: any[]) => void) => void;
  '*': (event: EventNames<T_EventMap>, ...args: any[]) => void;
};

/** if this raises a TS error: \
 * <RESERVED_EVENTS> elements != <ReservedEvents> keys \
 * fix it - match the two types
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _ASSERTION_: _AssertSync = true;

export function isReservedEventName(event: string) {
  return RESERVED_EVENTS.includes(event as (typeof RESERVED_EVENTS)[number]);
}

// sync guard — errors if the two diverge
type _AssertSync = (typeof RESERVED_EVENTS)[number] extends keyof ReservedEvents
  ? keyof ReservedEvents extends (typeof RESERVED_EVENTS)[number]
    ? true
    : never
  : never;

export type CombinedEvents<T_EventMap extends EventMap> = T_EventMap & ReservedEvents<T_EventMap>;

//-------------------------------------------------------
// combined utils types
//-------------------------------------------------------

export type EventListenerCombined<
  T_EventMap extends EventMap,
  T_Event extends EventNamesCombined<T_EventMap>,
> = EventListener<CombinedEvents<T_EventMap>, T_Event>;

export type EventNamesCombined<T_EventMap extends EventMap> = EventNames<
  CombinedEvents<T_EventMap>
>;

export type EventParamsCombined<
  T_EventMap extends EventMap,
  T_Event extends EventNamesCombined<T_EventMap>,
> = EventParams<CombinedEvents<T_EventMap>, T_Event>;
