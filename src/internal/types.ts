import type { BaseEvents, EventMap } from '../types.js';

export type AllEvents<T_EventMap extends EventMap> = T_EventMap & BaseEvents<T_EventMap>;
