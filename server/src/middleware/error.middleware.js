export function errorHandler(error, req, res, next) {
  let statusCode = error.statusCode || 
  (res.statusCode >= 400 ? res.statusCode : 500);

  let errorCode = error.code || "INTERNAL_ERROR";
  let message = error.message || "Internal server error";
  let details = error.details || null;

  if (error.name === "ValidationError") {
    statusCode = 400;
    errorCode = "DATABASE_VALIDATION_ERROR";
    message = "Database validation failed";

    details = Object.values(error.errors).map(
      (validationError) => ({
        field: validationError.path,
        message: validationError.message,
      })
    );
  }

  if (error.code === 11000) {
    statusCode = 409;

    const duplicateFields = Object.keys(
      error.keyPattern || error.keyValue || {}
    )[0];

    if (duplicatedField === "email") {
      errorCode = "EMAIL_ALREADY_EXISTS";
      message = "An account with this email already exists";
    } else if (duplicateField === "slug") {
      errorCode = "WORKSPACE_SLUG_ALREADY_EXISTS";
      message = "This workspace URL is already taken";
    } else {
      errorCode = "DUPLICATE_RECORD",
      message = "A record with these details already exists";
    }
  }

  const response = {
    success: false,
    code: errorCode,
    message,
  };

  if (details) {
    response.errors = details;
  }

  if (process.env.NODE_ENV === "development") {
    response.stack = error.stack;
  }

  return res.status(statusCode).json(response);
}