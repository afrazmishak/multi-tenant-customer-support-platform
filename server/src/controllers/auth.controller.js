import { authenticateUser, getCurrentUserSession } from "../services/auth.service.js"
import { createWorkspaceRegistration } from "../services/workspaceRegistration.service.js";
import {
    getAuthCookieClearOptions,
    getAuthCookieName,
    getAuthCookieOptions,
    signAuthToken,
} from "../utils/authToken.js";

export async function registerWorkspace(req, res) {
    const registration = await createWorkspaceRegistration(
        req.validatedBody
    );

    return res.status(201).json({
        success: true,
        message: "Workspace registered successfully",
        data: registration
    });
}

export async function login(req, res) {
    const authentication = await authenticateUser(
        req.validatedBody
    );

    const token = signAuthToken(authentication.user.id);

    res.cookie(
        getAuthCookieName(),
        token,
        getAuthCookieOptions()
    );

    return res.status(200).json({
        success: true,
        message: "Login successful",
        data: authentication,
    });
}

export async function getMe(req, res) {
    const session = await getCurrentUserSession(req.auth.user);

    return res.status(200).json({
        success: true,
        message: "Authenticated session retrieved successfully",
        data: session,
    });
}

export function logout(req, res) {
    res.clearCookie(
        getAuthCookieName(),
        getAuthCookieClearOptions()
    );

    return res.status(200).json({
        success: true,
        message: "Logout successful",
    });
}