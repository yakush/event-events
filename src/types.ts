import type { CombinedEvents } from './internal/types.js';

export type EventMap = {
  [event: string]: (...args: any[]) => void;
};

export type EventListener<
  T_EventMap extends EventMap,
  T_Event extends EventNames<T_EventMap>,
> = T_EventMap[T_Event];

//-------------------------------------------------------
// util types
//-------------------------------------------------------

export type EventNames<T_Map extends EventMap> = keyof T_Map & string;

export type EventParams<T_Map extends EventMap, T_Event extends EventNames<T_Map>> = Parameters<
  T_Map[T_Event]
>;

//-------------------------------------------------------
// config and construction
//-------------------------------------------------------

export type ErrorHandlingType =
  | 'ignore'
  | 'log'
  | 'warn'
  | 'error'
  | 'throw'
  | ((event: string, err: unknown) => void);

export type ConstructionParams = {
  maxListeners?: number;
  errorHandling?: ErrorHandlingType;
};
