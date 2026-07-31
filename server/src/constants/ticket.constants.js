export const TICKET_STATUSES = Object.freeze({
    OPEN: "open",
    IN_PROGRESS: "in_progress",
    WAITING_ON_CUSTOMER: "waiting_on_customer",
    RESOLVED: "resolved",
    CLOSED: "closed",
});

export const TICKET_STATUS_VALUES = Object.freeze(
    Object.values(TICKET_STATUSES)
);

export const TICKET_STATUS_TRANSITIONS = Object.freeze({
    [TICKET_STATUSES.OPEN]: Object.freeze([
        TICKET_STATUSES.IN_PROGRESS,
        TICKET_STATUSES.RESOLVED,
    ]),

    [TICKET_STATUSES.IN_PROGRESS]: Object.freeze([
        TICKET_STATUSES.WAITING_ON_CUSTOMER,
        TICKET_STATUSES.RESOLVED,
    ]),

    [TICKET_STATUSES.WAITING_ON_CUSTOMER]: Object.freeze([
        TICKET_STATUSES.IN_PROGRESS,
        TICKET_STATUSES.RESOLVED,
    ]),

    [TICKET_STATUSES.RESOLVED]: Object.freeze([
        TICKET_STATUSES.IN_PROGRESS,
        TICKET_STATUSES.CLOSED,
    ]),

    [TICKET_STATUSES.CLOSED]: Object.freeze([]),
});

export const TICKET_PRIORITIES = Object.freeze({
    LOW: "low",
    NORMAL: "normal",
    HIGH: "high",
    URGENT: "urgent",
});

export const TICKET_PRIORITY_VALUES = Object.freeze(
    Object.values(TICKET_PRIORITIES)
);

export const TICKET_SOURCES = Object.freeze({
    INTERNAL: "internal",
    WEB: "web",
    EMAIL: "email",
    CHAT: "chat",
    PHONE: "phone",
    API: "api",
});

export const TICKET_SOURCE_VALUES = Object.freeze(
    Object.values(TICKET_SOURCES)
);

export const TICKET_REFERENCE_PREFIX = "TKT";

export const TICKET_LIMITS = Object.freeze({
    SUBJECT_MAX_LENGTH: 200,
    DESCRIPTION_MAX_LENGTH: 10_000,
    CATEGORY_MAX_LENGTH: 80,

    TAG_MAX_LENGTH: 40,
    MAX_TAGS: 20,

    RESOLUTION_SUMMARY_MAX_LENGTH: 5000,

    SEARCH_MAX_LENGTH: 200,
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
});