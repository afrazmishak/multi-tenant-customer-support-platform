import mongoose from "mongoose";

import { User } from "../models/index.js";
import AppError from "../utils/AppError.js";
import {
    getAuthCookieName,
    verifyAuthToken,
} from "../utils/authToken.js";

export async function authenticate(req, res, next) {
    try {
        const cookieName = getAuthCookieName();
        const token = req.cookies?.[cookieName];

        if (!token) {
            throw new AppError(
                "Authentication is required",
                401,
                "AUTHENTICATION_REQUIRED"
            );
        }

        let decodedToken;

        try {
            decodedToken = verifyAuthToken(token);
        } catch (error) {
            if (error.name === "TokenExpiredError") {
                throw new AppError(
                    "Your session has expired. Please log in again",
                    401,
                    "SESSION_EXPIRED"
                );
            }

            throw new AppError(
                "Your session is invalid. Please log in again",
                401,
                "INVALID_SESSION"
            );
        }

        if (
            typeof decodedToken !== "object" ||
            !decodedToken.sub ||
            !mongoose.isValidObjectId(decodedToken.sub)
        ) {
            throw new AppError(
                "Your session is invalid. Please log in again",
                401,
                "INVALID_SESSION"
            );
        }

        const user = await User.findById(decodedToken.sub)
            .select(
                "name email status emailVerifiedAt lastLoginAt createdAt updatedAt"
            )
            .lean();

        if (!user) {
            throw new AppError(
                "The account associated with this session no longer exists",
                401,
                "INVALID_SESSION"
            );
        }

        if (user.status !== "active") {
            throw new AppError(
                "This account is currently disabled",
                403,
                "ACCOUNT_DISABLED"
            );
        }

        req.auth = {
            userId: user._id.toString(),
            user,
        };

        return next();
    } catch (error) {
        return next(error);
    }
}