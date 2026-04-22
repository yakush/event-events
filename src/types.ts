export type BaseEvents<T_EventMap extends EventMap = EventMap> = {
  newListener: (event: EventNames<T_EventMap>, listener: (...args: any[]) => void) => void;
  removeListener: (event: EventNames<T_EventMap>, listener: (...args: any[]) => void) => void;
};

export type EventMap = {
  [event: string]: (...args: any[]) => void;
};

export type EventListener<
  T_EventMap extends EventMap,
  T_Event extends EventNames<T_EventMap>,
> = T_EventMap[T_Event];

//-------------------------------------------------------
// config
//-------------------------------------------------------

export type ErrorHandlingType =
  | 'ignore'
  | 'log'
  | 'warn'
  | 'error'
  | 'throw'
  | ((event: string, err: unknown) => void);

export type constructionParams = {
  maxListeners?: number;
  errorHandling?: ErrorHandlingType;
};
//-------------------------------------------------------
// util types
//-------------------------------------------------------

export type EventNames<T_Map extends EventMap> = keyof T_Map & string;

export type EventParams<T_Map extends EventMap, T_Event extends EventNames<T_Map>> = Parameters<
  T_Map[T_Event]
>;
