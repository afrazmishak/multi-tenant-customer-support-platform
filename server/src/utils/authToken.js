import jwt from "jsonwebtoken";

const TOKEN_ISSUER = "multi-tenant-support-api";
const TOKEN_AUDIENCE = "multi-tenant-support-client";

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
        throw new Error(
            "JWT_SECRET must be defined and contain at least 32 characters"
        );
    }

    return secret;
}

export function getJwtLifetimeSeconds() {
    const lifetime = Number.parseInt(
        process.env.JWT_EXPIRES_IN_SECONDS || "604800",
        10
    );

    if (!Number.isInteger(lifetime) || lifetime <= 0) {
        throw new Error(
            "JWT_EXPIRES_IN_SECONDS must be a positive integer"
        );
    }

    return lifetime;
}

export function getAuthCookieName(userId) {
    return process.env.AUTH_COOKIE_NAME || "support_session";
}

export function signAuthToken(userId) {
    if (!userId) {
        throw new Error("A user ID is required to create an auth token");
    }

    return jwt.sign({}, getJwtSecret(), {
        subject: userId.toString(),
        expiresIn: getJwtLifetimeSeconds(),
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
        algorithm: "HS256",
    });
}

export function verifyAuthToken(token) {
    return jwt.verify(token, getJwtSecret(), {
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
        algorithms: ["HS256"],
    });
}

export function getAuthCookieOptions() {
    const isProduction = process.env.NODE_ENV === "production";

    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: getJwtLifetimeSeconds() * 1000,
    };
}

export function getAuthCookieClearOptions() {
    const isProduction = process.env.NODE_ENV === "production";

    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
    };
}