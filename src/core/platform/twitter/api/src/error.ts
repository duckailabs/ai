// errors.ts

export class TwitterError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: any
  ) {
    super(message);
    this.name = "TwitterError";
  }
}

export class TwitterAuthError extends TwitterError {
  constructor(message: string, data?: any) {
    super(401, message, data);
    this.name = "TwitterAuthError";
  }
}

export class TwitterRateLimitError extends TwitterError {
  constructor(message: string, data?: any) {
    super(429, message, data);
    this.name = "TwitterRateLimitError";
  }
}

export class TwitterMediaUploadError extends TwitterError {
  constructor(message: string, data?: any) {
    super(400, message, data);
    this.name = "TwitterMediaUploadError";
  }
}
