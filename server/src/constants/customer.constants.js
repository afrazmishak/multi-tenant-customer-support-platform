export const CUSTOMER_STATUSES = Object.freeze({
    ACTIVE: "active",
    INACTIVE: "inactive"
});

export const CUSTOMER_STATUS_VALUES = Object.freeze(
    Object.values(CUSTOMER_STATUSES)
);

export const CUSTOMER_LIMITS = Object.freeze({
    NAME_MAX_LENGTH: 120,
    EMAIL_MAX_LENGTH: 254,
    PHONE_MAX_LENGTH: 30,
    COMPANY_MAX_LENGTH: 120,
    JOB_TITLE_MAX_LENGTH: 120,
    NOTES_MAX_LENGTH: 5000,
    TAG_MAX_LENGTH: 40,
    MAX_TAGS: 20,
    MAX_CUSTOM_FIELDS: 50,
});