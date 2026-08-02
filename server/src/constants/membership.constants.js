export const MEMBERSHIP_ROLES = Object.freeze({
    OWNER: "owner",
    ADMIN: "admin",
    AGENT: "agent",
});

export const MEMBERSHIP_ROLE_VALUES = Object.freeze(
    Object.values(MEMBERSHIP_ROLES)
);

export const MEMBERSHIP_STATUSES = Object.freeze({
    ACTIVE: "active",
    INVITED: "invited",
    SUSPENDED: "suspended",
});

export const MEMBERSHIP_STATUS_VALUES = Object.freeze(
    Object.values(MEMBERSHIP_STATUSES)
);