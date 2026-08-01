import AppError from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import {
    assignTicket,
    changeTicketStatus,
    createTicket,
    getTicketById,
    listTickets,
    updateTicket,
} from "../services/ticket.service.js";

function getWorkspaceIdFromRequest(req) {
    const workspaceId =
        req.tenantContext?.workspace?.id ??
        req.tenantContext?.tenantId;

    if (!workspaceId) {
        throw new AppError(
            "Workspace context is missing from the request",
            500
        );
    }

    return workspaceId;
}

function getAuthenticatedUserId(req) {
    const userId =
        req.auth?.userId ??
        req.tenantContext?.userId;

    if (!userId) {
        throw new AppError(
            "Authenticated user context is missing from the request",
            500
        );
    }

    return userId;
}

export const createTicketController = asyncHandler(
    async (req, res) => {
        const workspaceId =
            getWorkspaceIdFromRequest(req);

        const actorUserId =
            getAuthenticatedUserId(req);

        const ticket = await createTicket({
            workspaceId,
            actorUserId,
            input: req.body,
        });

        res.status(201).json({
            success: true,
            message: "Ticket created successfully",
            data: {
                ticket,
            },
        });
    }
);

export const listTicketsController = asyncHandler(
    async (req, res) => {
        const workspaceId =
            getWorkspaceIdFromRequest(req);

        const result = await listTickets({
            workspaceId,
            query: req.query,
        });

        res.status(200).json({
            success: true,
            data: {
                tickets: result.tickets,
                pagination: result.pagination,
                filters: result.filters,
            },
        });
    }
);

export const getTicketController = asyncHandler(
    async (req, res) => {
        const workspaceId =
            getWorkspaceIdFromRequest(req);

        const ticket = await getTicketById({
            workspaceId,
            ticketId: req.params.ticketId,
        });

        res.status(200).json({
            success: true,
            data: {
                ticket,
            },
        });
    }
);

export const updateTicketController = asyncHandler(
    async (req, res) => {
        const workspaceId =
            getWorkspaceIdFromRequest(req);

        const actorUserId =
            getAuthenticatedUserId(req);

        const ticket = await updateTicket({
            workspaceId,
            ticketId: req.params.ticketId,
            actorUserId,
            input: req.body,
        });

        res.status(200).json({
            success: true,
            message: "Ticket updated successfully",
            data: {
                ticket,
            },
        });
    }
);

export const assignTicketController = asyncHandler(
    async (req, res) => {
        const workspaceId =
            getWorkspaceIdFromRequest(req);

        const actorUserId =
            getAuthenticatedUserId(req);

        const ticket = await assignTicket({
            workspaceId,
            ticketId: req.params.ticketId,
            actorUserId,
            input: req.body,
        });

        const message = ticket.assignedTo
            ? "Ticket assigned successfully"
            : "Ticket unassigned successfully";

        res.status(200).json({
            success: true,
            message,
            data: {
                ticket,
            },
        });
    }
);

export const changeTicketStatusController =
    asyncHandler(async (req, res) => {
        const workspaceId =
            getWorkspaceIdFromRequest(req);

        const actorUserId =
            getAuthenticatedUserId(req);

        const ticket = await changeTicketStatus({
            workspaceId,
            ticketId: req.params.ticketId,
            actorUserId,
            input: req.body,
        });

        res.status(200).json({
            success: true,
            message: `Ticket status changed to ${ticket.status}`,
            data: {
                ticket,
            },
        });
    });