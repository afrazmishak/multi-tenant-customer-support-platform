import { Router } from "express";

import {
    MEMBERSHIP_ROLES,
} from "../constants/membership.constants.js";

import {
    getWorkspaceContext,
    getWorkspacePresenceDirectoryController,
    listWorkspaceMembers,
} from "../controllers/workspace.controller.js";
import { authenticate } from "../middleware/authenticate.middleware.js";
import { authorizeRoles, } from "../middleware/authorizeRoles.middleware.js";
import { resolveTenantContext, } from "../middleware/resolveTenantContext.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);

router.get(
    "/:workspaceSlug/context",
    resolveTenantContext,
    getWorkspaceContext
);

router.get(
    "/:workspaceSlug/members",
    resolveTenantContext,
    authorizeRoles(
        MEMBERSHIP_ROLES.OWNER,
        MEMBERSHIP_ROLES.ADMIN
    ),
    asyncHandler(listWorkspaceMembers)
);

router.get(
    "/:workspaceSlug/directory",
    resolveTenantContext,
    authorizeRoles(
        MEMBERSHIP_ROLES.OWNER,
        MEMBERSHIP_ROLES.ADMIN,
        MEMBERSHIP_ROLES.AGENT
    ),
    getWorkspacePresenceDirectoryController
);

export default router;