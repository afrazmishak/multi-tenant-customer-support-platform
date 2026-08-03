import { Router } from "express";

import {
    createTicketMessageController,
    getTicketMessageController,
    listTicketMessagesController,
    updateTicketMessageController,
} from "../controllers/ticketMessage.controller.js";

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

const TICKET_MESSAGE_READ_ROLES = [
    MEMBERSHIP_ROLES.OWNER,
    MEMBERSHIP_ROLES.ADMIN,
    MEMBERSHIP_ROLES.AGENT,
];

const TICKET_MESSAGE_CREATE_ROLES = [
    MEMBERSHIP_ROLES.OWNER,
    MEMBERSHIP_ROLES.ADMIN,
    MEMBERSHIP_ROLES.AGENT,
];

const TICKET_MESSAGE_UPDATE_ROLES = [
    MEMBERSHIP_ROLES.OWNER,
    MEMBERSHIP_ROLES.ADMIN,
    MEMBERSHIP_ROLES.AGENT,
];

router.use(authenticate);
router.use(resolveTenantContext);

router
    .route("/")
    .get(
        authorizeRoles(
            ...TICKET_MESSAGE_READ_ROLES
        ),
        listTicketMessagesController
    )
    .post(
        authorizeRoles(
            ...TICKET_MESSAGE_CREATE_ROLES
        ),
        createTicketMessageController
    );

    router
    .route("/:messageId")
    .get(
        authorizeRoles(
            ...TICKET_MESSAGE_READ_ROLES
        ),
        getTicketMessageController
    )
    .patch(
        authorizeRoles(
            ...TICKET_MESSAGE_UPDATE_ROLES
        ),
        updateTicketMessageController
    );

export default router;