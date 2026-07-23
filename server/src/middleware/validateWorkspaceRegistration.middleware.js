import AppError from "../utils/AppError.js";
import { createSlug } from "../utils/createSlug.js";
import { wouldTruncatePassword } from "../utils/password.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function addError(errors, field, message) {
    errors.push({
        field,
        message,
    });
}

export function validateWorkspaceRegistration(req, res, next) {
    const body = req.body || {};
    const errors = [];

    const ownerName = normalizeString(body.ownerName);
    const ownerEmail = normalizeString(body.ownerEmail).toLowerCase();

    // Never trim passwords. Spaces may intentionally be part of one.
    const password =
        typeof body.password === "string" ? body.password : "";

    const workspaceName = normalizeString(body.workspaceName);

    const requestedSlug = normalizeString(body.workspaceSlug);
    const workspaceSlug = createSlug(
        requestedSlug || workspaceName
    );

    if (ownerName.length < 2 || ownerName.length > 100) {
        addError(
            errors,
            "ownerName",
            "Owner name must contain between 2 and 100 characters"
        );
    }

    if (
        ownerEmail.length > 254 ||
        !EMAIL_PATTERN.test(ownerEmail)
    ) {
        addError(
            errors,
            "ownerEmail",
            "Please provide a valid email address"
        );
    }

    if (password.length < 10) {
        addError(
            errors,
            "password",
            "Password must contain at least 10 characters"
        );
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        addError(
            errors,
            "password",
            "Password must contain at least one letter and one number"
        );
    }

    if (password && wouldTruncatePassword(password)) {
        addError(
            errors,
            "password",
            "Password cannot exceed 72 UTF-8 bytes"
        );
    }

    if (
        workspaceName.length < 2 ||
        workspaceName.length > 120
    ) {
        addError(
            errors,
            "workspaceName",
            "Workspace name must contain between 2 and 120 characters"
        );
    }

    if (
        workspaceSlug.length < 2 ||
        workspaceSlug.length > 80 ||
        !SLUG_PATTERN.test(workspaceSlug)
    ) {
        addError(
            errors,
            "workspaceSlug",
            "Workspace slug must contain lowercase letters, numbers and hyphens"
        );
    }

    if (errors.length > 0) {
        return next(
            new AppError(
                "Workspace registration validation failed",
                400,
                "VALIDATION_ERROR",
                errors
            )
        );
    }

    req.validatedBody = {
        ownerName,
        ownerEmail,
        password,
        workspaceName,
        workspaceSlug,
    };

    return next();
}