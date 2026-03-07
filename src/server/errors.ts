export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'PROFILE_NOT_FOUND'
  | 'INVALID_PROFILE_DATA'
  | 'INVALID_USERNAME_FORMAT'
  | 'USERNAME_TAKEN'
  | 'PROFILE_PHOTO_NOT_FOUND'
  | 'INVALID_FILE'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'RATE_LIMIT_BACKEND_ERROR'
  | 'INVALID_ACTION'
  | 'INVALID_TICKET_DATA'
  | 'TICKET_PERSISTENCE_ERROR'
  | 'D1_MIGRATION_MISSING'
  | 'D1_MIGRATION_MISSING_USERNAME'
  | 'CONFIG_ERROR'
  | 'INTERNAL_SERVER_ERROR';

export type FieldError = {
  field: string;
  message: string;
};

export type ErrorResponseBody = {
  error: ErrorCode;
  message: string;
  detail?: string;
  fieldErrors?: FieldError[];
};

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fieldErrors?: FieldError[];

  constructor(code: ErrorCode, message: string, status: number, fieldErrors?: FieldError[]) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export class ValidationError extends DomainError {
  constructor(code: Extract<ErrorCode, 'INVALID_PROFILE_DATA' | 'INVALID_USERNAME_FORMAT' | 'INVALID_FILE' | 'FILE_TOO_LARGE' | 'UNSUPPORTED_MEDIA_TYPE' | 'INVALID_ACTION' | 'INVALID_TICKET_DATA'>, message: string, fieldErrors?: FieldError[]) {
    super(code, message, 400, fieldErrors);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DomainError {
  constructor(code: Extract<ErrorCode, 'PROFILE_NOT_FOUND' | 'PROFILE_PHOTO_NOT_FOUND'>, message: string) {
    super(code, message, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends DomainError {
  constructor(code: Extract<ErrorCode, 'USERNAME_TAKEN'>, message: string) {
    super(code, message, 409);
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'No autorizado. Inicia sesión de nuevo.') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class RateLimitError extends DomainError {
  constructor(message: string) {
    super('RATE_LIMIT_EXCEEDED', message, 429);
    this.name = 'RateLimitError';
  }
}

export class DependencyError extends DomainError {
  constructor(code: Extract<ErrorCode, 'D1_MIGRATION_MISSING' | 'D1_MIGRATION_MISSING_USERNAME' | 'RATE_LIMIT_BACKEND_ERROR' | 'CONFIG_ERROR'>, message: string) {
    super(code, message, 500);
    this.name = 'DependencyError';
  }
}

export class InternalError extends DomainError {
  constructor(message = 'Error interno del servidor.') {
    super('INTERNAL_SERVER_ERROR', message, 500);
    this.name = 'InternalError';
  }
}

type ErrorLike = unknown;

function isDomainError(err: ErrorLike): err is DomainError {
  return typeof err === 'object' && err !== null && 'code' in err && 'status' in err;
}

export function mapErrorToResponseBody(err: ErrorLike, includeDetail: boolean): { status: number; body: ErrorResponseBody } {
  if (isDomainError(err)) {
    const body: ErrorResponseBody = {
      error: err.code,
      message: err.message,
    };
    if (includeDetail && err.stack) {
      body.detail = err.stack;
    }
    if (err.fieldErrors && err.fieldErrors.length > 0) {
      body.fieldErrors = err.fieldErrors;
    }
    return {
      status: err.status,
      body,
    };
  }

  const unknownError = err instanceof Error ? err : new Error('Unknown error');
  const body: ErrorResponseBody = {
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Error interno del servidor.',
  };
  if (includeDetail && unknownError.stack) {
    body.detail = unknownError.stack;
  }
  return {
    status: 500,
    body,
  };
}

