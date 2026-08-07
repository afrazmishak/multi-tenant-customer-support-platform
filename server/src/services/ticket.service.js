import mongoose from "mongoose";

import Customer from "../models/Customer.js";
import Membership from "../models/Membership.js";
import Ticket from "../models/Ticket.js";
import TicketCounter from "../models/TicketCounter.js";

import AppError from "../utils/AppError.js";

import {
    MEMBERSHIP_ROLES,
} from "../constants/membership.constants.js";

import {
    TICKET_REFERENCE_PREFIX,
    TICKET_STATUSES,
} from "../constants/ticket.constants.js";

import {
    TICKET_ACTIVITY_TYPES,
} from "../constants/ticketActivity.constants.js";

import {
    buildTicketChanges,
    recordTicketActivity,
} from "./ticketActivity.service.js";

import {
    validateCreateTicketInput,
    validateTicketAssignmentInput,
    validateTicketListQuery,
    validateTicketStatusInput,
    validateUpdateTicketInput,
} from "../validators/ticket.validator.js";

import {
    applyTicketStatusTransition,
} from "./ticketLifecycle.service.js";

const ASSIGNABLE_MEMBERSHIP_ROLES = new Set([
    MEMBERSHIP_ROLES.OWNER,
    MEMBERSHIP_ROLES.ADMIN,
    MEMBERSHIP_ROLES.AGENT,
]);

const TICKET_UPDATE_AUDIT_FIELDS = [
    "subject",
    "description",
    "priority",
    "category",
    "tags",
];

function normalizeObjectId(value, fieldName) {
    if (value instanceof mongoose.Types.ObjectId) {
        return value;
    }

    if (
        typeof value !== "string" ||
        !/^[a-fA-F0-9]{24}$/.test(value.trim())
    ) {
        throw new AppError(
            `${fieldName} must be a valid identifier`,
            400
        );
    }

    return new mongoose.Types.ObjectId(value.trim());
}

function escapeRegularExpression(value) {
    return value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}

function isDuplicateKeyError(error) {
    return error?.code === 11000;
}

function isDuplicateTicketNumberError(error) {
    if (!isDuplicateKeyError(error)) {
        return false;
    }

    return Boolean(
        error?.keyPattern?.ticketNumber ||
        error?.keyValue?.ticketNumber ||
        error?.message?.includes(
            "unique_ticket_number_per_workspace"
        )
    );
}

function handleTicketPersistenceError(error) {
    if (error?.name === "VersionError") {
        throw new AppError(
            "This ticket was modified by another request. Refresh the ticket and try again.",
            409
        );
    }

    throw error;
}

function buildTicketReference(ticketNumber) {
    if (!Number.isSafeInteger(ticketNumber)) {
        return null;
    }

    return `${TICKET_REFERENCE_PREFIX}-${String(
        ticketNumber
    ).padStart(6, "0")}`;
}

function toTicketOutput(ticket) {
    const output =
        typeof ticket?.toObject === "function"
            ? ticket.toObject({
                virtuals: true,
            })
            : {
                ...ticket,
            };

    if (!output.reference) {
        output.reference = buildTicketReference(
            output.ticketNumber
        );
    }

    return output;
}

async function allocateTicketNumber(workspaceId) {
    try {
        const counter =
            await TicketCounter.findOneAndUpdate(
                {
                    workspace: workspaceId,
                },
                {
                    $inc: {
                        value: 1,
                    },

                    $setOnInsert: {
                        workspace: workspaceId,
                    },
                },
                {
                    returnDocument: "after",
                    upsert: true,

                    /*
                     * Prevent the schema default value of 0
                     * from conflicting with $inc during insert.
                     */
                    setDefaultsOnInsert: false,
                }
            );

        if (
            !counter ||
            !Number.isSafeInteger(counter.value) ||
            counter.value < 1
        ) {
            throw new AppError(
                "Ticket number allocation failed",
                500
            );
        }

        return counter.value;
    } catch (error) {
        /*
         * Two first-time requests may race while creating
         * the workspace counter. The unique workspace index
         * ensures only one counter survives.
         */
        if (isDuplicateKeyError(error)) {
            const counter =
                await TicketCounter.findOneAndUpdate(
                    {
                        workspace: workspaceId,
                    },
                    {
                        $inc: {
                            value: 1,
                        },
                    },
                    {
                        returnDocument: "after",
                    }
                );

            if (
                !counter ||
                !Number.isSafeInteger(counter.value)
            ) {
                throw new AppError(
                    "Ticket number allocation failed",
                    500
                );
            }

            return counter.value;
        }

        throw error;
    }
}

async function assertCustomerAvailable({
    workspaceId,
    customerId,
}) {
    const customer = await Customer.findOne({
        _id: customerId,
        workspace: workspaceId,
        isArchived: false,
    })
        .select(
            "_id name email status isArchived workspace"
        )
        .lean();

    if (!customer) {
        throw new AppError(
            "Customer was not found in this workspace",
            404
        );
    }

    return customer;
}

async function assertAssignableWorkspaceMember({
    workspaceId,
    userId,
    session = null,
}) {
    const query = Membership.findOne({
        tenantId: workspaceId,
        userId,
        status: "active",
    }).select(
        "_id tenantId userId role status"
    );

    if (session) {
        query.session(session);
    }

    const membership = await query.lean();

    if (!membership) {
        throw new AppError(
            "The assigned user is not an active member of this workspace",
            409
        );
    }

    if (
        !ASSIGNABLE_MEMBERSHIP_ROLES.has(
            membership.role
        )
    ) {
        throw new AppError(
            "This workspace member cannot be assigned tickets",
            403
        );
    }

    return membership;
}

async function findTicketDocument({
    workspaceId,
    ticketId,
    session = null,
}) {
    const query = Ticket.findOne({
        _id: ticketId,
        workspace: workspaceId,
    });

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

function parseTicketNumberSearch(search) {
    const normalizedSearch = search
        .trim()
        .toUpperCase();

    const match = normalizedSearch.match(
        /^(?:TKT-)?0*(\d+)$/
    );

    if (!match) {
        return null;
    }

    const ticketNumber = Number(match[1]);

    if (
        !Number.isSafeInteger(ticketNumber) ||
        ticketNumber < 1
    ) {
        return null;
    }

    return ticketNumber;
}

function buildTicketFilter(
    workspaceId,
    options
) {
    const filter = {
        workspace: workspaceId,
    };

    if (options.status) {
        filter.status = options.status;
    }

    if (options.priority) {
        filter.priority = options.priority;
    }

    if (options.source) {
        filter.source = options.source;
    }

    if (options.customerId) {
        filter.customer = normalizeObjectId(
            options.customerId,
            "Customer ID"
        );
    }

    if (options.assignedTo === "unassigned") {
        filter.assignedTo = null;
    } else if (options.assignedTo) {
        filter.assignedTo = normalizeObjectId(
            options.assignedTo,
            "Assigned user ID"
        );
    }

    if (options.tags.length > 0) {
        filter.tags = {
            $all: options.tags,
        };
    }

    if (options.search) {
        const escapedSearch =
            escapeRegularExpression(
                options.search
            );

        const searchExpression = new RegExp(
            escapedSearch,
            "i"
        );

        const searchConditions = [
            {
                subject: searchExpression,
            },
            {
                description: searchExpression,
            },
            {
                category: searchExpression,
            },
        ];

        const searchedTicketNumber =
            parseTicketNumberSearch(
                options.search
            );

        if (searchedTicketNumber !== null) {
            searchConditions.push({
                ticketNumber:
                    searchedTicketNumber,
            });
        }

        filter.$or = searchConditions;
    }

    return filter;
}

function getStatusActivityType(
    previousStatus,
    nextStatus
) {
    if (
        nextStatus ===
        TICKET_STATUSES.CLOSED
    ) {
        return TICKET_ACTIVITY_TYPES.CLOSED;
    }

    if (
        nextStatus ===
        TICKET_STATUSES.RESOLVED
    ) {
        return TICKET_ACTIVITY_TYPES.RESOLVED;
    }

    if (
        previousStatus ===
        TICKET_STATUSES.RESOLVED &&
        nextStatus ===
        TICKET_STATUSES.IN_PROGRESS
    ) {
        return TICKET_ACTIVITY_TYPES.REOPENED;
    }

    return TICKET_ACTIVITY_TYPES.STATUS_CHANGED;
}

function buildTicketSort(sortBy, sortOrder) {
    return {
        [sortBy]: sortOrder,
        _id: sortOrder,
    };
}

export async function createTicket({
    workspaceId,
    actorUserId,
    input,
}) {
    const normalizedWorkspaceId =
        normalizeObjectId(
            workspaceId,
            "Workspace ID"
        );

    const normalizedActorUserId =
        normalizeObjectId(
            actorUserId,
            "User ID"
        );

    const validatedInput =
        validateCreateTicketInput(input);

    const normalizedCustomerId =
        normalizeObjectId(
            validatedInput.customerId,
            "Customer ID"
        );

    await assertCustomerAvailable({
        workspaceId: normalizedWorkspaceId,
        customerId: normalizedCustomerId,
    });

    let normalizedAssignedUserId = null;

    if (validatedInput.assignedTo) {
        normalizedAssignedUserId =
            normalizeObjectId(
                validatedInput.assignedTo,
                "Assigned user ID"
            );

        await assertAssignableWorkspaceMember({
            workspaceId:
                normalizedWorkspaceId,
            userId:
                normalizedAssignedUserId,
        });
    }

    /*
     * A retry is defensive protection against an unexpected
     * stale counter or manually imported ticket number.
     */
    const maximumAttempts = 3;

    for (
        let attempt = 1;
        attempt <= maximumAttempts;
        attempt += 1
    ) {
        const ticketNumber =
            await allocateTicketNumber(
                normalizedWorkspaceId
            );

        const now = new Date();

        const ticket = new Ticket({
            workspace:
                normalizedWorkspaceId,

            ticketNumber,

            customer:
                normalizedCustomerId,

            subject:
                validatedInput.subject,

            description:
                validatedInput.description,

            priority:
                validatedInput.priority,

            source:
                validatedInput.source,

            category:
                validatedInput.category,

            tags:
                validatedInput.tags,

            assignedTo:
                normalizedAssignedUserId,

            assignedAt:
                normalizedAssignedUserId
                    ? now
                    : null,

            assignedBy:
                normalizedAssignedUserId
                    ? normalizedActorUserId
                    : null,

            createdBy:
                normalizedActorUserId,

            updatedBy:
                normalizedActorUserId,

            lastActivityAt: now,
        });

        try {
            let createdTicket = null;

            await mongoose.connection.transaction(
                async (session) => {
                    await ticket.save({
                        session,
                    });

                    await recordTicketActivity({
                        workspaceId:
                            normalizedWorkspaceId,

                        ticketId:
                            ticket._id,

                        type:
                            TICKET_ACTIVITY_TYPES.TICKET_CREATED,

                        actorUserId:
                            normalizedActorUserId,

                        metadata: {
                            ticketNumber:
                                ticket.ticketNumber,

                            reference:
                                buildTicketReference(
                                    ticket.ticketNumber
                                ),

                            subject:
                                ticket.subject,

                            customerId:
                                ticket.customer,

                            priority:
                                ticket.priority,

                            source:
                                ticket.source,
                        },

                        session,
                    });

                    createdTicket = ticket;
                }
            );

            return toTicketOutput(
                createdTicket
            );

        } catch (error) {
            if (
                isDuplicateTicketNumberError(
                    error
                ) &&
                attempt < maximumAttempts
            ) {
                continue;
            }

            handleTicketPersistenceError(
                error
            );
        }
    }

    throw new AppError(
        "Unable to allocate a unique ticket number",
        500
    );
}

export async function listTickets({
    workspaceId,
    query = {},
}) {
    const normalizedWorkspaceId =
        normalizeObjectId(
            workspaceId,
            "Workspace ID"
        );

    const options =
        validateTicketListQuery(query);

    const filter = buildTicketFilter(
        normalizedWorkspaceId,
        options
    );

    const sort = buildTicketSort(
        options.sortBy,
        options.sortOrder
    );

    const [ticketResults, totalTickets] =
        await Promise.all([
            Ticket.find(filter)
                .sort(sort)
                .skip(options.skip)
                .limit(options.limit)
                .lean(),

            Ticket.countDocuments(filter),
        ]);

    const tickets = ticketResults.map(
        toTicketOutput
    );

    const totalPages = Math.ceil(
        totalTickets / options.limit
    );

    return {
        tickets,

        pagination: {
            page: options.page,
            limit: options.limit,
            totalTickets,
            totalPages,

            hasPreviousPage:
                options.page > 1,

            hasNextPage:
                options.page < totalPages,
        },

        filters: {
            status: options.status,
            priority: options.priority,
            source: options.source,
            customerId:
                options.customerId,
            assignedTo:
                options.assignedTo,
            search: options.search,
            tags: options.tags,

            sortBy: options.sortBy,

            sortOrder:
                options.sortOrder === 1
                    ? "asc"
                    : "desc",
        },
    };
}

export async function getTicketById({
    workspaceId,
    ticketId,
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

    const ticket = await Ticket.findOne({
        _id: normalizedTicketId,
        workspace:
            normalizedWorkspaceId,
    }).lean();

    if (!ticket) {
        throw new AppError(
            "Ticket was not found in this workspace",
            404
        );
    }

    return toTicketOutput(ticket);
}

export async function updateTicket({
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
            "User ID"
        );

    const validatedInput =
        validateUpdateTicketInput(input);

    let updatedTicket = null;

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

                if (
                    ticket.status ===
                    TICKET_STATUSES.CLOSED
                ) {
                    throw new AppError(
                        "Closed tickets cannot be updated",
                        409
                    );
                }

                // Capture the ticket BEFORE changing it.
                const before =
                    ticket.toObject();

                // Apply validated changes.
                ticket.set(
                    validatedInput
                );

                const now =
                    new Date();

                ticket.updatedBy =
                    normalizedActorUserId;

                ticket.lastActivityAt =
                    now;

                // Save the ticket inside the transaction.
                await ticket.save({
                    session,
                });

                // Compare old values with new values.
                const changes =
                    buildTicketChanges(
                        before,
                        ticket.toObject(),
                        TICKET_UPDATE_AUDIT_FIELDS
                    );

                // Only create an audit event if something
                // actually changed.
                if (
                    changes.length > 0
                ) {
                    await recordTicketActivity({
                        workspaceId:
                            normalizedWorkspaceId,

                        ticketId:
                            normalizedTicketId,

                        type:
                            TICKET_ACTIVITY_TYPES.TICKET_UPDATED,

                        actorUserId:
                            normalizedActorUserId,

                        changes,

                        session,
                    });
                }

                updatedTicket =
                    ticket;
            }
        );

        return toTicketOutput(
            updatedTicket
        );
    } catch (error) {
        handleTicketPersistenceError(
            error
        );
    }
}

export async function assignTicket({
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
            "User ID"
        );

    const validatedInput =
        validateTicketAssignmentInput(
            input
        );

    let updatedTicket = null;

    try {
        await mongoose.connection.transaction(
            async (session) => {
                // 1. Find ticket inside transaction
                const ticket =
                    await findTicketDocument({
                        workspaceId:
                            normalizedWorkspaceId,

                        ticketId:
                            normalizedTicketId,

                        session,
                    });

                // 2. Closed tickets cannot be reassigned
                if (
                    ticket.status ===
                    TICKET_STATUSES.CLOSED
                ) {
                    throw new AppError(
                        "Closed tickets cannot be reassigned",
                        409
                    );
                }

                // 3. Take snapshot BEFORE assignment changes
                const before =
                    ticket.toObject();

                const currentAssignedUserId =
                    ticket.assignedTo
                        ?.toString() ??
                    null;

                let nextAssignedUserId = null;

                // 4. Unassignment
                if (
                    validatedInput.assignedTo ===
                    null
                ) {
                    if (
                        !currentAssignedUserId
                    ) {
                        throw new AppError(
                            "Ticket is already unassigned",
                            409
                        );
                    }

                    ticket.assignedTo =
                        null;

                    ticket.assignedAt =
                        null;

                    ticket.assignedBy =
                        null;
                } else {
                    // 5. Assignment
                    nextAssignedUserId =
                        normalizeObjectId(
                            validatedInput.assignedTo,
                            "Assigned user ID"
                        );

                    if (
                        currentAssignedUserId ===
                        nextAssignedUserId.toString()
                    ) {
                        throw new AppError(
                            "Ticket is already assigned to this user",
                            409
                        );
                    }

                    await assertAssignableWorkspaceMember({
                        workspaceId:
                            normalizedWorkspaceId,

                        userId:
                            nextAssignedUserId,

                        session,
                    });

                    ticket.assignedTo =
                        nextAssignedUserId;

                    ticket.assignedAt =
                        new Date();

                    ticket.assignedBy =
                        normalizedActorUserId;
                }

                // 6. Update ticket activity metadata
                ticket.updatedBy =
                    normalizedActorUserId;

                ticket.lastActivityAt =
                    new Date();

                // 7. Save ticket inside transaction
                await ticket.save({
                    session,
                });

                // 8. Build before → after audit change
                const changes =
                    buildTicketChanges(
                        before,
                        ticket.toObject(),
                        [
                            "assignedTo",
                        ]
                    );

                // 9. Determine audit type
                const activityType =
                    nextAssignedUserId
                        ? TICKET_ACTIVITY_TYPES.ASSIGNED
                        : TICKET_ACTIVITY_TYPES.UNASSIGNED;

                // 10. Record audit event
                await recordTicketActivity({
                    workspaceId:
                        normalizedWorkspaceId,

                    ticketId:
                        normalizedTicketId,

                    type:
                        activityType,

                    actorUserId:
                        normalizedActorUserId,

                    changes,

                    metadata: {
                        assignedTo:
                            nextAssignedUserId,
                    },

                    session,
                });

                updatedTicket =
                    ticket;
            }
        );

        return toTicketOutput(
            updatedTicket
        );
    } catch (error) {
        handleTicketPersistenceError(
            error
        );
    }
}

export async function changeTicketStatus({
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
            "User ID"
        );

    const validatedInput =
        validateTicketStatusInput(input);

    let updatedTicket = null;

    try {
        await mongoose.connection.transaction(
            async (session) => {
                // 1. Find ticket inside the transaction
                const ticket =
                    await findTicketDocument({
                        workspaceId:
                            normalizedWorkspaceId,

                        ticketId:
                            normalizedTicketId,

                        session,
                    });

                // 2. Remember status BEFORE changing it
                const previousStatus =
                    ticket.status;

                const before =
                    ticket.toObject();

                // 3. Use your existing lifecycle logic
                applyTicketStatusTransition({
                    ticket,

                    nextStatus:
                        validatedInput.status,

                    actorUserId:
                        normalizedActorUserId,

                    resolutionSummary:
                        validatedInput.resolutionSummary,
                });

                // 4. Update ticket activity information
                ticket.updatedBy =
                    normalizedActorUserId;

                ticket.lastActivityAt =
                    new Date();

                // 5. Save the ticket
                await ticket.save({
                    session,
                });

                // 6. Work out what kind of audit event occurred
                const activityType =
                    getStatusActivityType(
                        previousStatus,
                        ticket.status
                    );

                // 7. Record before → after status
                const changes =
                    buildTicketChanges(
                        before,
                        ticket.toObject(),
                        [
                            "status",
                        ]
                    );

                // 8. Extra information for special events
                const metadata = {};

                if (
                    activityType ===
                    TICKET_ACTIVITY_TYPES.RESOLVED
                ) {
                    metadata.resolutionSummary =
                        ticket.resolutionSummary;
                }

                // 9. Record the activity
                await recordTicketActivity({
                    workspaceId:
                        normalizedWorkspaceId,

                    ticketId:
                        normalizedTicketId,

                    type:
                        activityType,

                    actorUserId:
                        normalizedActorUserId,

                    changes,
                    metadata,

                    session,
                });

                updatedTicket =
                    ticket;
            }
        );

        return toTicketOutput(
            updatedTicket
        );
    } catch (error) {
        handleTicketPersistenceError(
            error
        );
    }
}