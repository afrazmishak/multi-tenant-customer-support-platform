import { rateLimit } from "express-rate-limit";

function createRateLimitResponse(code, message) {
    return {
        success: false,
        code,
        message,
    };
}

export const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,

    standardHeaders: true,
    legacyHeaders: false,

    message: createRateLimitResponse(
        "TOO_MANY_LOGIN_ATTEMPTS",
        "Too many login attempts. Please try again later."
    ),
});

export const registrationRateLimiter = rateLimit({
    windowMs: 60 * 60 *1000,
    limit: 10,

    standardHeaders: true,
    legacyHeaders: false,

    message: createRateLimitResponse(
        "TOO_MANY_REGISTRATION_ATTEMPTS",
        "Too many workspace registration attempts. Please try again later."
    ),
});