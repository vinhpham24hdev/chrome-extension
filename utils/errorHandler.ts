export class S3ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = "S3ServiceError";
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export const ERROR_CODES = {
  NETWORK_ERROR: "NETWORK_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UPLOAD_FAILED: "UPLOAD_FAILED",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  SERVICE_NOT_INITIALIZED: "SERVICE_NOT_INITIALIZED",
  PRESIGNED_URL_FAILED: "PRESIGNED_URL_FAILED",
  UPLOAD_TIMEOUT: "UPLOAD_TIMEOUT",
  UPLOAD_CANCELLED: "UPLOAD_CANCELLED",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export function createS3Error(
  code: ErrorCode,
  message: string,
  statusCode?: number,
  retryable: boolean = false
): S3ServiceError {
  return new S3ServiceError(message, code, statusCode, retryable);
}

export function handleUploadError(error: unknown): S3ServiceError {
  if (error instanceof S3ServiceError) {
    return error;
  }

  if (error instanceof Error) {
    // Network errors
    if (error.message.includes("fetch") || error.message.includes("network")) {
      return createS3Error(
        ERROR_CODES.NETWORK_ERROR,
        error.message,
        undefined,
        true
      );
    }

    // Timeout errors
    if (error.message.includes("timeout")) {
      return createS3Error(
        ERROR_CODES.UPLOAD_TIMEOUT,
        error.message,
        undefined,
        true
      );
    }

    // Generic error
    return createS3Error(ERROR_CODES.UPLOAD_FAILED, error.message);
  }

  return createS3Error(ERROR_CODES.UPLOAD_FAILED, "Unknown upload error");
}
