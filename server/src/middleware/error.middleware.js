export function errorHandler(error, req, res, next) {
  let statusCode = res.statusCode === 200
   ? 500
   : res.statusCode;

  let message = error.message || "Internal server error";
  let errors;

  if (error.name === "ValidationError") {
    statusCode = 400;
    message = "Validation failed";

    errors = Object.values(error.errors).map((validationError) => ({
      field: validationError.path,
      message: validationError.message,
    }));
  }

  if (error.code === 11000) {
    statusCode = 409;

    const duplicateFields = Object.keys(
      error.keyValue || error.keyPattern || {}
    );

    message = duplicateFields.length
      ? `${duplicateFields.join(", ")} already exists`
      : "A duplicate record already exists";
  }

  const response = {
    success: false,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  if (process.env.NODE_ENV === "development") {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
}