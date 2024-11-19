export * from "./character";
export * from "./llm";
export * from "./memory";
export * from "./style";

// Add any shared types or unions here
export type Timestamp = string | Date;

export type BaseMetadata = {
  timestamp: Timestamp;
  source: string;
  version?: string;
  [key: string]: any;
};

export type ErrorResponse = {
  error: string;
  code: string;
  details?: Record<string, any>;
};

export type SuccessResponse<T> = {
  data: T;
  metadata?: BaseMetadata;
};

export type APIResponse<T> = SuccessResponse<T> | ErrorResponse;

// Add utility type helpers
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];
