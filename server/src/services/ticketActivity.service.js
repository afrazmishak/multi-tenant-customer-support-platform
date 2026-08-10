import mongoose from "mongoose";

import Ticket from "../models/Ticket.js";

import {
    validateTicketActivityListQuery,
} from "../validators/ticketActivity.validator.js";

import TicketActivity from "../models/TicketActivity.js";
import AppError from "../utils/AppError.js";

import {
    TICKET_ACTIVITY_ENTITY_TYPES,
    TICKET_ACTIVITY_ENTITY_TYPE_VALUES,
    TICKET_ACTIVITY_TYPE_VALUES,
} from "../constants/ticketActivity.constants.js";

function normalizeObjectId(
    value,
    fieldName,
    {
        required = true,
    } = {}
) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        if (!required) {
            return null;
        }

        throw new AppError(
            `${fieldName} is required`,
            500
        );
    }

    const normalizedValue =
        value?.toString?.() ?? "";

    if (
        !/^[a-fA-F0-9]{24}$/.test(
            normalizedValue
        )
    ) {
        throw new AppError(
            `${fieldName} must be a valid identifier`,
            500
        );
    }

    return new mongoose.Types.ObjectId(
        normalizedValue
    );
}

function normalizeAuditValue(value) {
    if (
        value === undefined ||
        value === null
    ) {
        return null;
    }

    if (
        value instanceof
        mongoose.Types.ObjectId
    ) {
        return value.toString();
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.map(
            normalizeAuditValue
        );
    }

    if (
        typeof value === "object"
    ) {
        if (
            typeof value.toObject ===
            "function"
        ) {
            return normalizeAuditValue(
                value.toObject()
            );
        }

        return Object.fromEntries(
            Object.entries(value).map(
                ([key, nestedValue]) => [
                    key,
                    normalizeAuditValue(
                        nestedValue
                    ),
                ]
            )
        );
    }

    return value;
}

function assertActivityType(type) {
    if (
        !TICKET_ACTIVITY_TYPE_VALUES.includes(
            type
        )
    ) {
        throw new AppError(
            `Unsupported ticket activity type: ${type}`,
            500
        );
    }
}

function assertEntityType(entityType) {
    if (
        !TICKET_ACTIVITY_ENTITY_TYPE_VALUES.includes(
            entityType
        )
    ) {
        throw new AppError(
            `Unsupported ticket activity entity type: ${entityType}`,
            500
        );
    }
}

function normalizeLookupObjectId(
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

export function buildTicketChanges(
    before,
    after,
    fields
) {
    if (!Array.isArray(fields)) {
        throw new AppError(
            "Ticket activity change fields must be an array",
            500
        );
    }

    const changes = [];

    for (const field of fields) {
        const previousValue =
            normalizeAuditValue(
                before?.[field]
            );

        const nextValue =
            normalizeAuditValue(
                after?.[field]
            );

        if (
            JSON.stringify(
                previousValue
            ) ===
            JSON.stringify(
                nextValue
            )
        ) {
            continue;
        }

        changes.push({
            field,
            from:
                previousValue,
            to:
                nextValue,
        });
    }

    return changes;
}

export async function recordTicketActivity({
    workspaceId,
    ticketId,
    type,
    actorUserId = null,

    entityType =
        TICKET_ACTIVITY_ENTITY_TYPES.TICKET,

    entityId = null,
    changes = [],
    metadata = {},
    session = null,
}) {
    assertActivityType(type);
    assertEntityType(entityType);

    const normalizedWorkspaceId =
        normalizeObjectId(
            workspaceId,
            "Activity workspace ID"
        );

    const normalizedTicketId =
        normalizeObjectId(
            ticketId,
            "Activity ticket ID"
        );

    const normalizedActorUserId =
        normalizeObjectId(
            actorUserId,
            "Activity actor user ID",
            {
                required: false,
            }
        );

    let normalizedEntityId;

    if (
        entityType ===
        TICKET_ACTIVITY_ENTITY_TYPES.TICKET
    ) {
        normalizedEntityId =
            normalizeObjectId(
                entityId ??
                    normalizedTicketId,

                "Activity entity ID"
            );
    } else {
        normalizedEntityId =
            normalizeObjectId(
                entityId,
                "Activity message entity ID"
            );
    }

    if (!Array.isArray(changes)) {
        throw new AppError(
            "Activity changes must be an array",
            500
        );
    }

    const normalizedChanges =
        changes.map((change) => ({
            field:
                change.field,

            from:
                normalizeAuditValue(
                    change.from
                ),

            to:
                normalizeAuditValue(
                    change.to
                ),
        }));

    const activity =
        new TicketActivity({
            workspace:
                normalizedWorkspaceId,

            ticket:
                normalizedTicketId,

            type,

            actorUser:
                normalizedActorUserId,

            entityType,

            entityId:
                normalizedEntityId,

            changes:
                normalizedChanges,

            metadata:
                normalizeAuditValue(
                    metadata
                ),
        });

    if (session) {
        await activity.save({
            session,
        });
    } else {
        await activity.save();
    }

    return activity.toObject({
        virtuals: true,
    });
}

export async function listTicketActivities({
    workspaceId,
    ticketId,
    query = {},
}) {
    const normalizedWorkspaceId =
        normalizeLookupObjectId(
            workspaceId,
            "Workspace ID"
        );

    const normalizedTicketId =
        normalizeLookupObjectId(
            ticketId,
            "Ticket ID"
        );

    const validatedQuery =
        validateTicketActivityListQuery(
            query
        );

    const ticketExists =
        await Ticket.exists({
            _id:
                normalizedTicketId,

            workspace:
                normalizedWorkspaceId,
        });

    if (!ticketExists) {
        throw new AppError(
            "Ticket was not found in this workspace",
            404
        );
    }

    const filter = {
        workspace:
            normalizedWorkspaceId,

        ticket:
            normalizedTicketId,
    };

    if (
        validatedQuery.type
    ) {
        filter.type =
            validatedQuery.type;
    }

    const sortDirection =
        validatedQuery.sortOrder ===
        "desc"
            ? -1
            : 1;

    const skip =
        (
            validatedQuery.page -
            1
        ) *
        validatedQuery.limit;

    const [
        activities,
        totalActivities,
    ] = await Promise.all([
        TicketActivity.find(
            filter
        )
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
            .populate({
                path:
                    "actorUser",

                select:
                    "_id name username email",
            })
            .lean(),

        TicketActivity.countDocuments(
            filter
        ),
    ]);

    const totalPages =
        totalActivities === 0
            ? 0
            : Math.ceil(
                  totalActivities /
                      validatedQuery.limit
              );

    return {
        activities,

        pagination: {
            page:
                validatedQuery.page,

            limit:
                validatedQuery.limit,

            totalActivities,
            totalPages,

            hasPreviousPage:
                validatedQuery.page >
                1,

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