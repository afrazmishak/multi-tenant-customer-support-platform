import {
    MEMBERSHIP_STATUSES,
} from "../constants/membership.constants.js";
import { Membership, Tenant } from "../models/index.js";
import AppError from "../utils/AppError.js";

const WORKSPACE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function resolveTenantContext(req, res, next) {
    try {
        const rawWorkspaceSlug = req.params.workspaceSlug;

        const workspaceSlug = typeof rawWorkspaceSlug === "string"
            ? rawWorkspaceSlug.trim().toLowerCase()
            : "";

        if (
            workspaceSlug.length < 2 ||
            workspaceSlug.length > 80 ||
            !WORKSPACE_SLUG_PATTERN.test(workspaceSlug)
        ) {
            throw new AppError(
                "Invalid workspace slug",
                400,
                "INVALID_WORKSPACE_SLUG"
            );
        }

        const tenant = await Tenant.findOne({
            slug: workspaceSlug,
        })
            .select(
                "_id name slug status createdBy createdAt updatedAt"
            )
            .lean();

        if (!tenant) {
            throw new AppError(
                "Workspace not found",
                404,
                "WORKSPACE_NOT_FOUND"
            );
        }

        if (tenant.status !== "active") {
            throw new AppError(
                "This workspace is currently unavailable",
                403,
                "WORKSPACE_UNAVAILABLE"
            );
        }

        const membership = await Membership.findOne({
            tenantId: tenant._id,
            userId: req.auth.userId,
        })
            .select(
                "_id tenantId userId role status joinedAt createdAt updatedAt"
            )
            .lean();

        if (!membership) {
            throw new AppError(
                "You do not have access to this workspace",
                403,
                "WORKSPACE_ACCESS_DENIED"
            );
        }

        if (membership.status !== MEMBERSHIP_STATUSES.ACTIVE) {
            throw new AppError(
                "Your workspace membership is not active",
                403,
                "MEMBERSHIP_INACTIVE"
            );
        }

        req.tenantContext = {
            tenantId: tenant._id.toString(),
            userId: req.auth.userId,

            workspace: {
                id: tenant._id.toString(),
                name: tenant.name,
                slug: tenant.slug,
                status: tenant.status,
                createdBy: tenant.createdBy.toString(),
                createdAt: tenant.createdAt,
                updatedAt: tenant.updatedAt,
            },

            membership: {
                id: membership._id.toString(),
                role: membership.role,
                status: membership.status,
                joinedAt: membership.joinedAt,
                createdAt: membership.createdAt,
                updatedAt: membership.updatedAt,
            },
        };

        return next();
    } catch (error) {
        return next(error);
    }
}