import mongoose from "mongoose";

import Ticket from "../models/Ticket.js";
import TicketMessage from "../models/TicketMessage.js";

import AppError from "../utils/AppError.js";

import {
    TICKET_STATUSES,
} from "../constants/ticket.constants.js";

import {
    TICKET_MESSAGE_TYPES,
} from "../constants/ticketMessage.constants.js";

import {
    TICKET_ACTIVITY_ENTITY_TYPES,
    TICKET_ACTIVITY_TYPES,
} from "../constants/ticketActivity.constants.js";

import {
    recordTicketActivity,
} from "./ticketActivity.service.js";

import {
    validateCreateTicketMessageInput,
    validateTicketMessageListQuery,
    validateUpdateTicketMessageInput,
} from "../validators/ticketMessage.validator.js";

function normalizeObjectId(
    value,
    fieldName
) {
    const normalizedValue =
        value?.toString?.() ?? "";

    if (
        !/^[a-fA-F0-9]{24}$/.test(
            normalizedValue
        )
    ) {
        throw new AppError(
            `${fieldName} must be a valid identifier`,
            400
        );
    }

    return new mongoose.Types.ObjectId(
        normalizedValue
    );
}

function getMessageVisibility(type) {
    return type ===
        TICKET_MESSAGE_TYPES.INTERNAL_NOTE
        ? "internal"
        : "customer";
}

function toTicketMessageOutput(message) {
    const output =
        typeof message?.toObject === "function"
            ? message.toObject({
                virtuals: true,
            })
            : {
                ...message,
            };

    return {
        ...output,

        visibility:
            output.visibility ??
            getMessageVisibility(output.type),

        isInternal:
            output.isInternal ??
            output.type ===
            TICKET_MESSAGE_TYPES.INTERNAL_NOTE,
    };
}

function getValidationMessage(error) {
    const firstValidationError =
        Object.values(
            error?.errors ?? {}
        )[0];

    return (
        firstValidationError?.message ??
        "Ticket message validation failed"
    );
}

function handleMessagePersistenceError(error) {
    if (error instanceof AppError) {
        throw error;
    }

    if (error?.name === "VersionError") {
        throw new AppError(
            "The ticket message was changed by another request. Refresh and try again.",
            409
        );
    }

    if (error?.name === "ValidationError") {
        throw new AppError(
            getValidationMessage(error),
            400
        );
    }

    throw error;
}

async function findTicketDocument({
    workspaceId,
    ticketId,
    session = null,
}) {
    const query = Ticket.findOne({
        _id: ticketId,
        workspace: workspaceId,
    }).select(
        "_id workspace status lastActivityAt updatedBy"
    );

    if (session) {
        query.session(session);
    }

    const ticket = await query;

    if (!ticket) {
        throw new AppError(
            "Ticket was not found in this workspace",
            404
        );
    }

    return ticket;
}

function assertTicketAcceptsMessages(ticket) {
    if (
        ticket.status ===
        TICKET_STATUSES.CLOSED
    ) {
        throw new AppError(
            "Closed tickets cannot receive or modify messages",
            409
        );
    }
}

async function findTicketMessageDocument({
    workspaceId,
    ticketId,
    messageId,
    session = null,
}) {
    const query = TicketMessage.findOne({
        _id: messageId,
        workspace: workspaceId,
        ticket: ticketId,
    });

    if (session) {
        query.session(session);
    }

    const message = await query;

    if (!message) {
        throw new AppError(
            "Ticket message was not found",
            404
        );
    }

    return message;
}

export async function createTicketMessage({
    workspaceId,
    ticketId,
    actorUserId,
    input,
}) {
    const normalizedWorkspaceId =
        normalizeObjectId(
            workspaceId,
            "Workspace ID"
        );

    const normalizedTicketId =
        normalizeObjectId(
            ticketId,
            "Ticket ID"
        );

    const normalizedActorUserId =
        normalizeObjectId(
            actorUserId,
            "Authenticated user ID"
        );

    const validatedInput =
        validateCreateTicketMessageInput(
            input
        );

    let createdMessage = null;

    try {
        await mongoose.connection.transaction(
            async (session) => {
                const ticket =
                    await findTicketDocument({
                        workspaceId:
                            normalizedWorkspaceId,

                        ticketId:
                            normalizedTicketId,

                        session,
                    });

                assertTicketAcceptsMessages(
                    ticket
                );

                const message =
                    new TicketMessage({
                        workspace:
                            normalizedWorkspaceId,

                        ticket:
                            normalizedTicketId,

                        type:
                            validatedInput.type,

                        body:
                            validatedInput.body,

                        authorUser:
                            normalizedActorUserId,
                    });

                await message.save({
                    session,
                });

                const activityUpdate = await Ticket.updateOne(
                    {
                        _id:
                            normalizedTicketId,

                        workspace:
                            normalizedWorkspaceId,

                        status: {
                            $ne:
                                TICKET_STATUSES.CLOSED,
                        },
                    },
                    {
                        $set: {
                            lastActivityAt:
                                message.createdAt,

                            updatedBy:
                                normalizedActorUserId,
                        },
                    },
                    {
                        session,
                    }
                );

                if (
                    activityUpdate.matchedCount !== 1
                ) {
                    throw new AppError(
                        "Closed tickets cannot receive messages",
                        409
                    );
                }

                const activityType =
                    message.type ===
                        TICKET_MESSAGE_TYPES.INTERNAL_NOTE
                        ? TICKET_ACTIVITY_TYPES.INTERNAL_NOTE_ADDED
                        : TICKET_ACTIVITY_TYPES.PUBLIC_REPLY_ADDED;

                await recordTicketActivity({
                    workspaceId:
                        normalizedWorkspaceId,

                    ticketId:
                        normalizedTicketId,

                    type:
                        activityType,

                    actorUserId:
                        normalizedActorUserId,

                    entityType:
                        TICKET_ACTIVITY_ENTITY_TYPES.MESSAGE,

                    entityId:
                        message._id,

                    metadata: {
                        messageType:
                            message.type,
                    },

                    session,
                });

                createdMessage = message;
            }
        );

        return toTicketMessageOutput(
            createdMessage
        );
    } catch (error) {
        handleMessagePersistenceError(
            error
        );
    }
}

export async function listTicketMessages({
    workspaceId,
    ticketId,
    query = {},
}) {
    const normalizedWorkspaceId =
        normalizeObjectId(
            workspaceId,
            "Workspace ID"
        );

    const normalizedTicketId =
        normalizeObjectId(
            ticketId,
            "Ticket ID"
        );

    const validatedQuery =
        validateTicketMessageListQuery(
            query
        );

    await findTicketDocument({
        workspaceId:
            normalizedWorkspaceId,

        ticketId:
            normalizedTicketId,
    });

    const filter = {
        workspace:
            normalizedWorkspaceId,

        ticket:
            normalizedTicketId,
    };

    if (validatedQuery.type) {
        filter.type =
            validatedQuery.type;
    }

    const sortDirection =
        validatedQuery.sortOrder === "desc"
            ? -1
            : 1;

    const skip =
        (validatedQuery.page - 1) *
        validatedQuery.limit;

    const [
        messages,
        totalMessages,
    ] = await Promise.all([
        TicketMessage.find(filter)
            .sort({
                createdAt:
                    sortDirection,

                _id:
                    sortDirection,
            })
            .skip(skip)
            .limit(
                validatedQuery.limit
            )
            .lean(),

        TicketMessage.countDocuments(
            filter
        ),
    ]);

    const totalPages =
        totalMessages === 0
            ? 0
            : Math.ceil(
                totalMessages /
                validatedQuery.limit
            );

    return {
        messages:
            messages.map(
                toTicketMessageOutput
            ),

        pagination: {
            page:
                validatedQuery.page,

            limit:
                validatedQuery.limit,

            totalMessages,
            totalPages,

            hasPreviousPage:
                validatedQuery.page > 1,

            hasNextPage:
                validatedQuery.page <
                totalPages,
        },

        filters: {
            type:
                validatedQuery.type ??
                null,

            sortOrder:
                validatedQuery.sortOrder,
        },
    };
}

export async function getTicketMessageById({
    workspaceId,
    ticketId,
    messageId,
}) {
    const normalizedWorkspaceId =
        normalizeObjectId(
            workspaceId,
            "Workspace ID"
        );

    const normalizedTicketId =
        normalizeObjectId(
            ticketId,
            "Ticket ID"
        );

    const normalizedMessageId =
        normalizeObjectId(
            messageId,
            "Ticket message ID"
        );

    await findTicketDocument({
        workspaceId:
            normalizedWorkspaceId,

        ticketId:
            normalizedTicketId,
    });

    const message =
        await findTicketMessageDocument({
            workspaceId:
                normalizedWorkspaceId,

            ticketId:
                normalizedTicketId,

            messageId:
                normalizedMessageId,
        });

    return toTicketMessageOutput(
        message
    );
}

export async function updateTicketMessage({
    workspaceId,
    ticketId,
    messageId,
    actorUserId,
    input,
}) {
    const normalizedWorkspaceId =
        normalizeObjectId(
            workspaceId,
            "Workspace ID"
        );

    const normalizedTicketId =
        normalizeObjectId(
            ticketId,
            "Ticket ID"
        );

    const normalizedMessageId =
        normalizeObjectId(
            messageId,
            "Ticket message ID"
        );

    const normalizedActorUserId =
        normalizeObjectId(
            actorUserId,
            "Authenticated user ID"
        );

    const validatedInput =
        validateUpdateTicketMessageInput(
            input
        );

    let updatedMessage = null;

    try {
        await mongoose.connection.transaction(
            async (session) => {
                const ticket =
                    await findTicketDocument({
                        workspaceId:
                            normalizedWorkspaceId,

                        ticketId:
                            normalizedTicketId,

                        session,
                    });

                assertTicketAcceptsMessages(
                    ticket
                );

                const message =
                    await findTicketMessageDocument({
                        workspaceId:
                            normalizedWorkspaceId,

                        ticketId:
                            normalizedTicketId,

                        messageId:
                            normalizedMessageId,

                        session,
                    });

                if (
                    message.authorUser.toString() !==
                    normalizedActorUserId.toString()
                ) {
                    throw new AppError(
                        "Only the original author can edit this ticket message",
                        403
                    );
                }

                if (
                    message.body ===
                    validatedInput.body
                ) {
                    throw new AppError(
                        "The ticket message already contains this body",
                        409
                    );
                }

                const editedAt = new Date();

                message.body =
                    validatedInput.body;

                message.editedAt =
                    editedAt;

                message.editedBy =
                    normalizedActorUserId;

                await message.save({
                    session,
                });

                const activityUpdate =
                    await Ticket.updateOne(
                        {
                            _id:
                                normalizedTicketId,

                            workspace:
                                normalizedWorkspaceId,

                            status: {
                                $ne:
                                    TICKET_STATUSES.CLOSED,
                            },
                        },
                        {
                            $set: {
                                lastActivityAt:
                                    editedAt,

                                updatedBy:
                                    normalizedActorUserId,
                            },
                        },
                        {
                            session,
                        }
                    );

                if (
                    activityUpdate.matchedCount !== 1
                ) {
                    throw new AppError(
                        "Closed tickets cannot modify messages",
                        409
                    );
                }

                await recordTicketActivity({
                    workspaceId:
                        normalizedWorkspaceId,

                    ticketId:
                        normalizedTicketId,

                    type:
                        TICKET_ACTIVITY_TYPES.MESSAGE_EDITED,

                    actorUserId:
                        normalizedActorUserId,

                    entityType:
                        TICKET_ACTIVITY_ENTITY_TYPES.MESSAGE,

                    entityId:
                        message._id,

                    metadata: {
                        messageType:
                            message.type,

                        editedAt:
                            message.editedAt,
                    },

                    session,
                });

                updatedMessage = message;
            }
        );

        return toTicketMessageOutput(
            updatedMessage
        );
    } catch (error) {
        handleMessagePersistenceError(
            error
        );
    }
}