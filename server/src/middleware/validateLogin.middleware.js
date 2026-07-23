import AppError from "../utils/AppError.js"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
}

export function validateLogin(req, res, next) {
    const body = req.body || {};
    const errors = [];

    const email = normalizeString(body.email).toLowerCase();

    const password = typeof body.password === "string" ? body.password : "";

    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
        errors.push({
            field: "email",
            message: "Please provide a valid email address",
        });
    }

    if (!password) {
        errors.push({
            field: "password",
            message: "Password is required",
        });
    }

    if (errors.length > 0) {
        return next(
            new AppError(
                "Login validation failed",
                400,
                "VALIDATION_ERROR",
                errors
            )
        );
    }

    req.validatedBody = {
        email,
        password,
    };

    return next();
}