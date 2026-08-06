export const TICKET_ACTIVITY_TYPES = Object.freeze({
    TICKET_CREATED: "ticket_created",
    TICKET_UPDATED: "ticket_updated",

    ASSIGNED: "assigned",
    UNASSIGNED: "unassigned",

    STATUS_CHANGED: "status_changed",
    RESOLVED: "resolved",
    REOPENED: "reopened",
    CLOSED: "closed",

    PUBLIC_REPLY_ADDED: "public_reply_added",
    INTERNAL_NOTE_ADDED: "internal_note_added",
    MESSAGE_EDITED: "message_edited",
});

export const TICKET_ACTIVITY_TYPE_VALUES = Object.freeze(
    Object.values(TICKET_ACTIVITY_TYPES)
);

export const TICKET_ACTIVITY_ENTITY_TYPES =
    Object.freeze({
        TICKET: "ticket",
        MESSAGE: "message",
    });

export const TICKET_ACTIVITY_ENTITY_TYPE_VALUES =
    Object.freeze(
        Object.values(
            TICKET_ACTIVITY_ENTITY_TYPES
        )
    );

export const TICKET_ACTIVITY_LIMITS =
    Object.freeze({
        DEFAULT_PAGE_SIZE: 50,
        MAX_PAGE_SIZE: 100,
    });