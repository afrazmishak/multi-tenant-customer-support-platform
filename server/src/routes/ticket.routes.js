import { Router } from "express";

import {
    assignTicketController,
    changeTicketStatusController,
    createTicketController,
    getTicketController,
    listTicketsController,
    updateTicketController,
} from "../controllers/ticket.controller.js";

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

const router = Router({
    mergeParams: true,
});

const TICKET_READ_ROLES = [
    MEMBERSHIP_ROLES.OWNER,
    MEMBERSHIP_ROLES.ADMIN,
    MEMBERSHIP_ROLES.AGENT,
];

const TICKET_CREATE_ROLES = [
    MEMBERSHIP_ROLES.OWNER,
    MEMBERSHIP_ROLES.ADMIN,
    MEMBERSHIP_ROLES.AGENT,
];

const TICKET_UPDATE_ROLES = [
    MEMBERSHIP_ROLES.OWNER,
    MEMBERSHIP_ROLES.ADMIN,
    MEMBERSHIP_ROLES.AGENT,
];

const TICKET_ASSIGNMENT_ROLES = [
    MEMBERSHIP_ROLES.OWNER,
    MEMBERSHIP_ROLES.ADMIN,
    MEMBERSHIP_ROLES.AGENT,
];

const TICKET_STATUS_ROLES = [
    MEMBERSHIP_ROLES.OWNER,
    MEMBERSHIP_ROLES.ADMIN,
    MEMBERSHIP_ROLES.AGENT,
];

router.use(authenticate);
router.use(resolveTenantContext);

router
    .route("/")
    .get(
        authorizeRoles(...TICKET_READ_ROLES),
        listTicketsController
    )
    .post(
        authorizeRoles(...TICKET_CREATE_ROLES),
        createTicketController
    );

router.patch(
    "/:ticketId/assignment",
    authorizeRoles(...TICKET_ASSIGNMENT_ROLES),
    assignTicketController
);

router.patch(
    "/:ticketId/status",
    authorizeRoles(...TICKET_STATUS_ROLES),
    changeTicketStatusController
);

router
    .route("/:ticketId")
    .get(
        authorizeRoles(...TICKET_READ_ROLES),
        getTicketController
    )
    .patch(
        authorizeRoles(...TICKET_UPDATE_ROLES),
        updateTicketController
    );

export default router;