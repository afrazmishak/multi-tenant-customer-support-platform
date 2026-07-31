import { Router } from "express";

import {
    archiveCustomerController,
    createCustomerController,
    getCustomerController,
    listCustomersController,
    restoreCustomerController,
    updateCustomerController,
} from "../controllers/customer.controller.js";

import {
    MEMBERSHIP_ROLES,
} from "../constants/membership.constants.js";

// Change only these imports if your Phase 1 names differ.
import { authenticate } from "../middleware/authenticate.middleware.js";
import { resolveTenantContext } from "../middleware/resolveTenantContext.middleware.js";
import { authorizeRoles } from "../middleware/authorizeRoles.middleware.js";

const router = Router({
    mergeParams: true,
});

const CUSTOMER_READ_ROLES = [
    MEMBERSHIP_ROLES.OWNER,
    MEMBERSHIP_ROLES.ADMIN,
    MEMBERSHIP_ROLES.AGENT,
];

const CUSTOMER_WRITE_ROLES = [
    MEMBERSHIP_ROLES.OWNER,
    MEMBERSHIP_ROLES.ADMIN,
    MEMBERSHIP_ROLES.AGENT,
];

const CUSTOMER_ARCHIVE_ROLES = [
    MEMBERSHIP_ROLES.OWNER,
    MEMBERSHIP_ROLES.ADMIN,
];

/*
 * Every customer endpoint requires:
 *
 * 1. Authentication
 * 2. A valid workspace from :workspaceSlug
 * 3. Active membership in that workspace
 */
router.use(authenticate);
router.use(resolveTenantContext);

/*
 * GET  /api/workspaces/:workspaceSlug/customers
 * POST /api/workspaces/:workspaceSlug/customers
 */
router
    .route("/")
    .get(
        authorizeRoles(...CUSTOMER_READ_ROLES),
        listCustomersController
    )
    .post(
        authorizeRoles(...CUSTOMER_WRITE_ROLES),
        createCustomerController
    );

/*
 * Restore must be explicit.
 *
 * PATCH /api/workspaces/:workspaceSlug/customers/:customerId/restore
 */
router.patch(
    "/:customerId/restore",
    authorizeRoles(...CUSTOMER_ARCHIVE_ROLES),
    restoreCustomerController
);

/*
 * GET    /api/workspaces/:workspaceSlug/customers/:customerId
 * PATCH  /api/workspaces/:workspaceSlug/customers/:customerId
 * DELETE /api/workspaces/:workspaceSlug/customers/:customerId
 */
router
    .route("/:customerId")
    .get(
        authorizeRoles(...CUSTOMER_READ_ROLES),
        getCustomerController
    )
    .patch(
        authorizeRoles(...CUSTOMER_WRITE_ROLES),
        updateCustomerController
    )
    .delete(
        authorizeRoles(...CUSTOMER_ARCHIVE_ROLES),
        archiveCustomerController
    );

export default router;