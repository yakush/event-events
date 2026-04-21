export type EventMap = {
  [event: string]: (...args: unknown[]) => void;
};

export type EventListener<
  T_EventMap extends EventMap,
  T_Event extends EventNames<T_EventMap>,
> = T_EventMap[T_Event];

//-------------------------------------------------------
// defaults
//-------------------------------------------------------

export type DefaultEventMap = EventMap & {
  [event: string]: (...args: unknown[]) => void;
};

//-------------------------------------------------------
// util types
//-------------------------------------------------------

export type EventNames<T_Map extends EventMap> = keyof T_Map & string;

export type EventParams<T_Map extends EventMap, T_Event extends EventNames<T_Map>> = Parameters<
  T_Map[T_Event]
>;
