import AppError from "../utils/AppError.js";

import {
    TICKET_LIMITS,
    TICKET_STATUSES,
    TICKET_STATUS_TRANSITIONS,
    TICKET_STATUS_VALUES,
} from "../constants/ticket.constants.js";

function normalizeStatus(value) {
    if (typeof value !== "string") {
        throw new AppError(
            "Ticket status must be a string",
            400
        );
    }

    const normalizedStatus = value.trim().toLowerCase();

    if (!TICKET_STATUS_VALUES.includes(normalizedStatus)) {
        throw new AppError(
            `Ticket status must be one of: ${TICKET_STATUS_VALUES.join(
                ", "
            )}`,
            400
        );
    }

    return normalizedStatus;
}

function normalizeResolutionSummary(value) {
    if (typeof value !== "string") {
        throw new AppError(
            "A resolution summary is required when resolving a ticket",
            400
        );
    }

    const normalizedSummary = value.trim();

    if (!normalizedSummary) {
        throw new AppError(
            "A resolution summary is required when resolving a ticket",
            400
        );
    }

    if (
        normalizedSummary.length >
        TICKET_LIMITS.RESOLUTION_SUMMARY_MAX_LENGTH
    ) {
        throw new AppError(
            `Resolution summary cannot exceed ${TICKET_LIMITS.RESOLUTION_SUMMARY_MAX_LENGTH} characters`,
            400
        );
    }

    return normalizedSummary;
}

function assertTicketDocument(ticket) {
    if (
        !ticket ||
        typeof ticket !== "object" ||
        typeof ticket.status !== "string"
    ) {
        throw new AppError(
            "A valid ticket document is required",
            500
        );
    }
}

function assertActorUserId(actorUserId) {
    if (!actorUserId) {
        throw new AppError(
            "Actor user ID is required for ticket status changes",
            500
        );
    }
}

export function getAllowedTicketStatusTransitions(status) {
    const normalizedStatus = normalizeStatus(status);

    return [
        ...(TICKET_STATUS_TRANSITIONS[
            normalizedStatus
        ] ?? []),
    ];
}

export function canTransitionTicketStatus({
    currentStatus,
    nextStatus,
}) {
    const normalizedCurrentStatus =
        normalizeStatus(currentStatus);

    const normalizedNextStatus =
        normalizeStatus(nextStatus);

    return (
        TICKET_STATUS_TRANSITIONS[
            normalizedCurrentStatus
        ]?.includes(normalizedNextStatus) ?? false
    );
}

export function assertTicketStatusTransition({
    currentStatus,
    nextStatus,
}) {
    const normalizedCurrentStatus =
        normalizeStatus(currentStatus);

    const normalizedNextStatus =
        normalizeStatus(nextStatus);

    if (
        normalizedCurrentStatus ===
        normalizedNextStatus
    ) {
        throw new AppError(
            `Ticket is already ${normalizedCurrentStatus}`,
            409
        );
    }

    const allowedTransitions =
        getAllowedTicketStatusTransitions(
            normalizedCurrentStatus
        );

    if (
        !allowedTransitions.includes(
            normalizedNextStatus
        )
    ) {
        const allowedMessage =
            allowedTransitions.length > 0
                ? allowedTransitions.join(", ")
                : "none";

        throw new AppError(
            `Ticket cannot transition from ${normalizedCurrentStatus} to ${normalizedNextStatus}. Allowed transitions: ${allowedMessage}`,
            409
        );
    }

    return {
        currentStatus: normalizedCurrentStatus,
        nextStatus: normalizedNextStatus,
    };
}

export function applyTicketStatusTransition({
    ticket,
    nextStatus,
    actorUserId,
    resolutionSummary,
    transitionAt = new Date(),
}) {
    assertTicketDocument(ticket);
    assertActorUserId(actorUserId);

    if (
        !(transitionAt instanceof Date) ||
        Number.isNaN(transitionAt.getTime())
    ) {
        throw new AppError(
            "Ticket transition time must be a valid date",
            500
        );
    }

    const {
        currentStatus,
        nextStatus: normalizedNextStatus,
    } = assertTicketStatusTransition({
        currentStatus: ticket.status,
        nextStatus,
    });

    /*
     * Resolving a ticket requires an explicit summary.
     */
    if (
        normalizedNextStatus ===
        TICKET_STATUSES.RESOLVED
    ) {
        const normalizedResolutionSummary =
            normalizeResolutionSummary(
                resolutionSummary
            );

        ticket.resolvedAt = transitionAt;
        ticket.resolvedBy = actorUserId;
        ticket.resolutionSummary =
            normalizedResolutionSummary;

        ticket.closedAt = null;
        ticket.closedBy = null;
    }

    /*
     * Reopening a resolved ticket clears the old resolution
     * because the issue is no longer considered resolved.
     */
    if (
        currentStatus === TICKET_STATUSES.RESOLVED &&
        normalizedNextStatus ===
            TICKET_STATUSES.IN_PROGRESS
    ) {
        ticket.resolvedAt = null;
        ticket.resolvedBy = null;
        ticket.resolutionSummary = null;

        ticket.closedAt = null;
        ticket.closedBy = null;
    }

    /*
     * A ticket can only reach closed from resolved because
     * the transition map enforces resolved → closed.
     */
    if (
        normalizedNextStatus ===
        TICKET_STATUSES.CLOSED
    ) {
        if (
            !ticket.resolvedAt ||
            !ticket.resolvedBy ||
            !ticket.resolutionSummary
        ) {
            throw new AppError(
                "Ticket cannot be closed because its resolution information is incomplete",
                409
            );
        }

        ticket.closedAt = transitionAt;
        ticket.closedBy = actorUserId;
    }

    ticket.status = normalizedNextStatus;
    ticket.updatedBy = actorUserId;
    ticket.lastActivityAt = transitionAt;

    return ticket;
}