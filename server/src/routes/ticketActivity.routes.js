import {
    Router,
} from "express";

import {
    listTicketActivitiesController,
} from "../controllers/ticketActivity.controller.js";

import {
    MEMBERSHIP_ROLES,
} from "../constants/membership.constants.js";

import {
    authenticate,
} from "../middleware/authenticate.middleware.js";

import {
    resolveTenantContext,
} from "../middleware/resolveTenantContext.middleware.js";

import {
    authorizeRoles,
} from "../middleware/authorizeRoles.middleware.js";

const router =
    Router({
        mergeParams:
            true,
    });

const TICKET_ACTIVITY_READ_ROLES =
    [
        MEMBERSHIP_ROLES.OWNER,
        MEMBERSHIP_ROLES.ADMIN,
        MEMBERSHIP_ROLES.AGENT,
    ];

router.use(
    authenticate
);

router.use(
    resolveTenantContext
);

router.get(
    "/",
    authorizeRoles(
        ...TICKET_ACTIVITY_READ_ROLES
    ),
    listTicketActivitiesController
);

export default router;