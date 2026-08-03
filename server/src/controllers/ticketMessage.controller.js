import AppError from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import {
    createTicketMessage,
    getTicketMessageById,
    listTicketMessages,
    updateTicketMessage,
} from "../services/ticketMessage.service.js";

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

function getTicketIdFromRequest(req) {
    const { ticketId } = req.params;

    if (!ticketId) {
        throw new AppError(
            "Ticket ID is missing from the request",
            400
        );
    }

    return ticketId;
}

function getMessageIdFromRequest(req) {
    const { messageId } = req.params;

    if (!messageId) {
        throw new AppError(
            "Ticket message ID is missing from the request",
            400
        );
    }

    return messageId;
}

export const createTicketMessageController =
    asyncHandler(async (req, res) => {
        const workspaceId =
            getWorkspaceIdFromRequest(req);

        const actorUserId =
            getAuthenticatedUserId(req);

        const ticketId =
            getTicketIdFromRequest(req);

        const message =
            await createTicketMessage({
                workspaceId,
                ticketId,
                actorUserId,
                input: req.body,
            });

        const responseMessage =
            message.isInternal
                ? "Internal note created successfully"
                : "Public reply created successfully";

        res.status(201).json({
            success: true,
            message: responseMessage,
            data: {
                message,
            },
        });
    });

export const listTicketMessagesController =
    asyncHandler(async (req, res) => {
        const workspaceId =
            getWorkspaceIdFromRequest(req);

        const ticketId =
            getTicketIdFromRequest(req);

        const result =
            await listTicketMessages({
                workspaceId,
                ticketId,
                query: req.query,
            });

        res.status(200).json({
            success: true,
            data: {
                messages:
                    result.messages,

                pagination:
                    result.pagination,

                filters:
                    result.filters,
            },
        });
    });

export const getTicketMessageController =
    asyncHandler(async (req, res) => {
        const workspaceId =
            getWorkspaceIdFromRequest(req);

        const ticketId =
            getTicketIdFromRequest(req);

        const messageId =
            getMessageIdFromRequest(req);

        const message =
            await getTicketMessageById({
                workspaceId,
                ticketId,
                messageId,
            });

        res.status(200).json({
            success: true,
            data: {
                message,
            },
        });
    });

export const updateTicketMessageController =
    asyncHandler(async (req, res) => {
        const workspaceId =
            getWorkspaceIdFromRequest(req);

        const actorUserId =
            getAuthenticatedUserId(req);

        const ticketId =
            getTicketIdFromRequest(req);

        const messageId =
            getMessageIdFromRequest(req);

        const message =
            await updateTicketMessage({
                workspaceId,
                ticketId,
                messageId,
                actorUserId,
                input: req.body,
            });

        res.status(200).json({
            success: true,
            message:
                "Ticket message updated successfully",

            data: {
                message,
            },
        });
    });