import {
  MEMBERSHIP_STATUSES,
} from "../constants/membership.constants.js";
import { Membership, Tenant } from "../models/index.js";

const WORKSPACE_SLUG_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function createSocketTenantError(message, code) {
  const error = new Error(message);

  error.data = {
    code,
  };

  return error;
}

export async function resolveSocketTenant(socket, next) {
  try {
    const rawWorkspaceSlug =
      socket.handshake.auth?.workspaceSlug;

    const workspaceSlug =
      typeof rawWorkspaceSlug === "string"
        ? rawWorkspaceSlug.trim().toLowerCase()
        : "";

    if (
      workspaceSlug.length < 2 ||
      workspaceSlug.length > 80 ||
      !WORKSPACE_SLUG_PATTERN.test(workspaceSlug)
    ) {
      return next(
        createSocketTenantError(
          "Invalid workspace slug",
          "INVALID_WORKSPACE_SLUG"
        )
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
      return next(
        createSocketTenantError(
          "Workspace not found",
          "WORKSPACE_NOT_FOUND"
        )
      );
    }

    if (tenant.status !== "active") {
      return next(
        createSocketTenantError(
          "This workspace is currently unavailable",
          "WORKSPACE_UNAVAILABLE"
        )
      );
    }

    const userId = socket.data.auth?.userId;

    if (!userId) {
      return next(
        createSocketTenantError(
          "Authentication is required",
          "AUTHENTICATION_REQUIRED"
        )
      );
    }

    const membership = await Membership.findOne({
      tenantId: tenant._id,
      userId,
    })
      .select(
        "_id tenantId userId role status joinedAt createdAt updatedAt"
      )
      .lean();

    if (!membership) {
      return next(
        createSocketTenantError(
          "You do not have access to this workspace",
          "WORKSPACE_ACCESS_DENIED"
        )
      );
    }

    if (
      membership.status !== MEMBERSHIP_STATUSES.ACTIVE
    ) {
      return next(
        createSocketTenantError(
          "Your workspace membership is not active",
          "MEMBERSHIP_INACTIVE"
        )
      );
    }

    socket.data.tenantContext = {
      tenantId: tenant._id.toString(),
      userId,

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
    console.error("Socket tenant resolution error:", error);

    return next(
      createSocketTenantError(
        "Unable to resolve workspace context",
        "TENANT_CONTEXT_ERROR"
      )
    );
  }
}