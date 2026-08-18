import mongoose from "mongoose";
import * as cookie from "cookie";

import { User } from "../models/index.js";
import { getAuthCookieName, verifyAuthToken, } from "../utils/authToken.js";

function createSocketAuthError(message, code) {
  const error = new Error(message);

  error.data = {
    code,
  };

  return error;
}

export async function authenticateSocket(socket, next) {
  try {
    const cookieHeader = socket.handshake.headers.cookie;

    if (!cookieHeader) {
      return next(
        createSocketAuthError(
          "Authentication is required",
          "AUTHENTICATION_REQUIRED"
        )
      );
    }

    const cookies = cookie.parseCookie(cookieHeader);
    
    const cookieName = getAuthCookieName();
    const token = cookies[cookieName];

    if (!token) {
      return next(
        createSocketAuthError(
          "Authentication is required",
          "AUTHENTICATION_REQUIRED"
        )
      );
    }

    let decodedToken;

    try {
      decodedToken = verifyAuthToken(token);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return next(
          createSocketAuthError(
            "Your session has expired. Please log in again",
            "SESSION_EXPIRED"
          )
        );
      }

      return next(
        createSocketAuthError(
          "Your session is invalid. Please log in again",
          "INVALID_SESSION"
        )
      );
    }

    if (
      typeof decodedToken !== "object" ||
      !decodedToken.sub ||
      !mongoose.isValidObjectId(decodedToken.sub)
    ) {
      return next(
        createSocketAuthError(
          "Your session is invalid. Please log in again",
          "INVALID_SESSION"
        )
      );
    }

    const user = await User.findById(decodedToken.sub)
      .select(
        "name email status emailVerifiedAt lastLoginAt createdAt updatedAt"
      )
      .lean();

    if (!user) {
      return next(
        createSocketAuthError(
          "The account associated with this session no longer exists",
          "INVALID_SESSION"
        )
      );
    }

    if (user.status !== "active") {
      return next(
        createSocketAuthError(
          "This account is currently disabled",
          "ACCOUNT_DISABLED"
        )
      );
    }

    socket.data.auth = {
      userId: user._id.toString(),
      user,
    };

    return next();
  } catch (error) {
    console.error("Socket authentication error:", error);

    return next(
      createSocketAuthError(
        "Socket authentication failed",
        "AUTHENTICATION_FAILED"
      )
    );
  }
}