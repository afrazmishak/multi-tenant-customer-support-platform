export const TICKET_MESSAGE_TYPES = Object.freeze({
    PUBLIC_REPLY: "public_reply",
    INTERNAL_NOTE: "internal_note",
});

export const TICKET_MESSAGE_TYPE_VALUES = Object.freeze(
    Object.values(TICKET_MESSAGE_TYPES)
);

export const TICKET_MESSAGE_LIMITS = Object.freeze({
    BODY_MIN_LENGTH: 1,
    BODY_MAX_LENGTH: 10_000,
});