import {
    MEMBERSHIP_ROLE_VALUES,
} from "../constants/membership.constants.js";
import AppError from "../utils/AppError.js";

const validRoles = new Set(MEMBERSHIP_ROLE_VALUES);

export function authorizeRoles(...allowedRoles) {
    if (allowedRoles.length === 0) {
        throw new Error(
            "authorizeRoles requires at least one allowed role"
        );
    }

    const invalidRoles = allowedRoles.filter(
        (role) => !validRoles.has(role)
    );

    if (invalidRoles.length > 0) {
        throw new Error(
            `Invalid authorization roles: ${invalidRoles.join(", ")}`
        );
    }

    const allowedRoleSet = new Set(allowedRoles);

    return function roleAuthorizationMiddleware(
        req,
        res,
        next
    ) {
        const membership = req.tenantContext?.membership;

        if (!membership) {
            return next(
                new AppError(
                    "Tenant context was not initialized",
                    500,
                    "TENANT_CONTEXT_MISSIING"
                )
            );
        }

        if (!allowedRoleSet.has(membership.role)) {
            return next(
                new AppError(
                    "You do not have permission to perform this action",
                    403,
                    "INSUFFICIENT_PERMISSIONS"
                )
            );
        }

        return next();
    }
}