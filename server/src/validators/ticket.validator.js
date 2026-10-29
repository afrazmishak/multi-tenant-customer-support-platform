import AppError from "../utils/AppError.js";

import {
    TICKET_LIMITS,
    TICKET_PRIORITY_VALUES,
    TICKET_SOURCE_VALUES,
    TICKET_STATUSES,
    TICKET_STATUS_VALUES,
} from "../constants/ticket.constants.js";

const OBJECT_ID_PATTERN = /^[a-fA-F0-9]{24}$/;

const CREATE_FIELDS = new Set([
    "customerId",
    "subject",
    "description",
    "priority",
    "source",
    "category",
    "tags",
    "assignedTo",
]);

const UPDATE_FIELDS = new Set([
    "subject",
    "description",
    "priority",
    "category",
    "tags",
]);

const STATUS_FIELDS = new Set([
    "status",
    "resolutionSummary",
]);

const ASSIGNMENT_FIELDS = new Set([
    "assignedTo",
]);

const LIST_QUERY_FIELDS = new Set([
    "view",
    "page",
    "limit",
    "status",
    "priority",
    "source",
    "customerId",
    "assignedTo",
    "search",
    "tags",
    "sort",
    "sortBy",
    "sortOrder",
]);

const SORT_FIELDS = new Set([
    "ticketNumber",
    "subject",
    "createdAt",
    "updatedAt",
    "lastActivityAt",
]);

const TICKET_QUEUE_VIEWS =
    new Set([
        "active",
        "awaiting_response",
        "stale",
        "all",
        "mine",
        "unassigned",
    ]);

const TICKET_QUEUE_SORTS =
    new Set([
        "updated_desc",
        "updated_asc",
        "priority_desc",
        "priority_asc",
        "created_asc",
        "created_desc"
    ]);

const TICKET_QUEUE_SORT_MAP = {
    updated_desc: {
        sortBy: "updatedAt",
        sortOrder: -1,
    },
    updated_asc: {
        sortBy: "updatedAt",
        sortOrder: 1,
    },
    priority_desc: {
        sortBy: "priority",
        sortOrder: -1,
    },
    priority_asc: {
        sortBy: "priority",
        sortOrder: 1,
    },
    created_desc: {
        sortBy: "createdAt",
        sortOrder: -1,
    },
    created_asc: {
        sortBy: "createdAt",
        sortOrder: 1,
    },
};

const DEFAULT_TICKET_PAGE = 1;
const DEFAULT_TICKET_LIMIT = 25;
const MAX_TICKET_LIMIT = 100;
const MAX_TICKET_SEARCH_LENGTH = 120;

function throwValidationError(message) {
    throw new AppError(message, 400);
}

function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(
        object,
        key
    );
}

function isPlainObject(value) {
    if (
        value === null ||
        typeof value !== "object" ||
        Array.isArray(value)
    ) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return (
        prototype === Object.prototype ||
        prototype === null
    );
}

function assertRequestObject(input) {
    if (!isPlainObject(input)) {
        throwValidationError(
            "Ticket data must be provided as a JSON object"
        );
    }
}

function rejectUnknownFields(input, allowedFields) {
    const unknownFields = Object.keys(input).filter(
        (field) => !allowedFields.has(field)
    );

    if (unknownFields.length > 0) {
        throwValidationError(
            `Unsupported ticket field${unknownFields.length === 1 ? "" : "s"
            }: ${unknownFields.join(", ")}`
        );
    }
}

function normalizeObjectId(value, fieldName) {
    if (
        typeof value !== "string" ||
        !OBJECT_ID_PATTERN.test(value.trim())
    ) {
        throwValidationError(
            `${fieldName} must be a valid identifier`
        );
    }

    return value.trim();
}

function normalizeRequiredText(
    value,
    fieldName,
    maxLength
) {
    if (typeof value !== "string") {
        throwValidationError(
            `${fieldName} must be a string`
        );
    }

    const normalizedValue = value.trim();

    if (!normalizedValue) {
        throwValidationError(
            `${fieldName} is required`
        );
    }

    if (normalizedValue.length > maxLength) {
        throwValidationError(
            `${fieldName} cannot exceed ${maxLength} characters`
        );
    }

    return normalizedValue;
}

function normalizeOptionalText(
    value,
    fieldName,
    maxLength
) {
    if (value === null) {
        return null;
    }

    if (typeof value !== "string") {
        throwValidationError(
            `${fieldName} must be a string or null`
        );
    }

    const normalizedValue = value.trim();

    if (!normalizedValue) {
        return null;
    }

    if (normalizedValue.length > maxLength) {
        throwValidationError(
            `${fieldName} cannot exceed ${maxLength} characters`
        );
    }

    return normalizedValue;
}

function normalizeEnum(
    value,
    fieldName,
    allowedValues
) {
    if (typeof value !== "string") {
        throwValidationError(
            `${fieldName} must be a string`
        );
    }

    const normalizedValue = value
        .trim()
        .toLowerCase();

    if (!allowedValues.includes(normalizedValue)) {
        throwValidationError(
            `${fieldName} must be one of: ${allowedValues.join(
                ", "
            )}`
        );
    }

    return normalizedValue;
}

function normalizeTags(value) {
    if (!Array.isArray(value)) {
        throwValidationError(
            "Ticket tags must be provided as an array"
        );
    }

    const normalizedTags = [];

    for (const tag of value) {
        if (typeof tag !== "string") {
            throwValidationError(
                "Every ticket tag must be a string"
            );
        }

        const normalizedTag = tag
            .trim()
            .toLowerCase();

        if (!normalizedTag) {
            continue;
        }

        if (
            normalizedTag.length >
            TICKET_LIMITS.TAG_MAX_LENGTH
        ) {
            throwValidationError(
                `Ticket tags cannot exceed ${TICKET_LIMITS.TAG_MAX_LENGTH} characters`
            );
        }

        if (!normalizedTags.includes(normalizedTag)) {
            normalizedTags.push(normalizedTag);
        }
    }

    if (
        normalizedTags.length >
        TICKET_LIMITS.MAX_TAGS
    ) {
        throwValidationError(
            `A ticket cannot have more than ${TICKET_LIMITS.MAX_TAGS} tags`
        );
    }

    return normalizedTags;
}

function validateMutableTicketFields(input) {
    const validatedInput = {};

    if (hasOwn(input, "subject")) {
        validatedInput.subject =
            normalizeRequiredText(
                input.subject,
                "Ticket subject",
                TICKET_LIMITS.SUBJECT_MAX_LENGTH
            );
    }

    if (hasOwn(input, "description")) {
        validatedInput.description =
            normalizeRequiredText(
                input.description,
                "Ticket description",
                TICKET_LIMITS.DESCRIPTION_MAX_LENGTH
            );
    }

    if (hasOwn(input, "priority")) {
        validatedInput.priority = normalizeEnum(
            input.priority,
            "Ticket priority",
            TICKET_PRIORITY_VALUES
        );
    }

    if (hasOwn(input, "category")) {
        validatedInput.category =
            normalizeOptionalText(
                input.category,
                "Ticket category",
                TICKET_LIMITS.CATEGORY_MAX_LENGTH
            );
    }

    if (hasOwn(input, "tags")) {
        validatedInput.tags = normalizeTags(
            input.tags
        );
    }

    return validatedInput;
}

export function validateCreateTicketInput(input) {
    assertRequestObject(input);
    rejectUnknownFields(input, CREATE_FIELDS);

    if (!hasOwn(input, "customerId")) {
        throwValidationError(
            "Ticket customerId is required"
        );
    }

    if (!hasOwn(input, "subject")) {
        throwValidationError(
            "Ticket subject is required"
        );
    }

    if (!hasOwn(input, "description")) {
        throwValidationError(
            "Ticket description is required"
        );
    }

    const validatedInput =
        validateMutableTicketFields(input);

    validatedInput.customerId =
        normalizeObjectId(
            input.customerId,
            "Customer ID"
        );

    if (hasOwn(input, "source")) {
        validatedInput.source = normalizeEnum(
            input.source,
            "Ticket source",
            TICKET_SOURCE_VALUES
        );
    }

    if (hasOwn(input, "assignedTo")) {
        validatedInput.assignedTo =
            input.assignedTo === null
                ? null
                : normalizeObjectId(
                    input.assignedTo,
                    "Assigned user ID"
                );
    }

    return validatedInput;
}

export function validateUpdateTicketInput(input) {
    assertRequestObject(input);
    rejectUnknownFields(input, UPDATE_FIELDS);

    if (Object.keys(input).length === 0) {
        throwValidationError(
            "At least one ticket field must be provided"
        );
    }

    return validateMutableTicketFields(input);
}

export function validateTicketStatusInput(input) {
    assertRequestObject(input);
    rejectUnknownFields(input, STATUS_FIELDS);

    if (!hasOwn(input, "status")) {
        throwValidationError(
            "Ticket status is required"
        );
    }

    const status = normalizeEnum(
        input.status,
        "Ticket status",
        TICKET_STATUS_VALUES
    );

    const validatedInput = {
        status,
    };

    if (status === TICKET_STATUSES.RESOLVED) {
        if (!hasOwn(input, "resolutionSummary")) {
            throwValidationError(
                "A resolution summary is required when resolving a ticket"
            );
        }

        validatedInput.resolutionSummary =
            normalizeRequiredText(
                input.resolutionSummary,
                "Resolution summary",
                TICKET_LIMITS.RESOLUTION_SUMMARY_MAX_LENGTH
            );
    } else if (
        hasOwn(input, "resolutionSummary")
    ) {
        throwValidationError(
            "resolutionSummary can only be provided when resolving a ticket"
        );
    }

    return validatedInput;
}

export function validateTicketAssignmentInput(input) {
    assertRequestObject(input);
    rejectUnknownFields(input, ASSIGNMENT_FIELDS);

    if (!hasOwn(input, "assignedTo")) {
        throwValidationError(
            "assignedTo is required"
        );
    }

    return {
        assignedTo:
            input.assignedTo === null
                ? null
                : normalizeObjectId(
                    input.assignedTo,
                    "Assigned user ID"
                ),
    };
}

function parsePositiveInteger(
    value,
    fieldName,
    defaultValue
) {
    if (value === undefined) {
        return defaultValue;
    }

    if (
        Array.isArray(value) ||
        typeof value === "object"
    ) {
        throwValidationError(
            `${fieldName} must be a positive integer`
        );
    }

    const normalizedValue = String(value).trim();

    if (!/^\d+$/.test(normalizedValue)) {
        throwValidationError(
            `${fieldName} must be a positive integer`
        );
    }

    const parsedValue = Number(normalizedValue);

    if (
        !Number.isSafeInteger(parsedValue) ||
        parsedValue < 1
    ) {
        throwValidationError(
            `${fieldName} must be a positive integer`
        );
    }

    return parsedValue;
}

function normalizeQueryTags(value) {
    if (value === undefined) {
        return [];
    }

    const values = Array.isArray(value)
        ? value
        : [value];

    const separatedTags = values.flatMap(
        (tagValue) =>
            String(tagValue).split(",")
    );

    return normalizeTags(separatedTags);
}

export function validateTicketListQuery(query = {}) {
    assertRequestObject(query);

    rejectUnknownFields(
        query,
        LIST_QUERY_FIELDS
    );

    const page = parsePositiveInteger(
        query.page,
        "Page",
        DEFAULT_TICKET_PAGE
    );

    const limit = parsePositiveInteger(
        query.limit,
        "Limit",
        DEFAULT_TICKET_LIMIT
    );

    if (limit > MAX_TICKET_LIMIT) {
        throwValidationError(
            `Limit cannot exceed ${MAX_TICKET_LIMIT}`
        );
    }
    
    const view = normalizeEnum(
        query.view ?? "active",
        "Ticket queue view",
        [...TICKET_QUEUE_VIEWS]
    );

    const result = {
        view,
        page,
        limit,
        skip: (page - 1) * limit,

        status: null,
        priority: null,
        source: null,
        customerId: null,
        assignedTo: null,
        search: null,
        tags: normalizeQueryTags(query.tags),
    }

    if (query.status !== undefined) {
        if (query.status !== "all") {
            result.status = normalizeEnum(
                query.status,
                "Ticket status",
                TICKET_STATUS_VALUES
            );
        }
    }

    if (queue.priority !== undefined) {
        if (queue.priority !== "all") {
            result.priority = normalizeEnum(
                queue.priority,
                "Ticket priority",
                TICKET_PRIORITY_VALUES
            );
        }
    }

    if (query.source !==  undefined) {
        result.source = normalizeEnum(
            query.source,
            "Ticket source",
            TICKET_SOURCE_VALUES
        );
    }

    if (query.customerId !== undefined) {
        result.customerId = normalizeObjectId(
            query.customerId,
            "Customer ID"
        );
    }

    if (query.assignedTo !== undefined) {
        result.search = normalizeOptionalText(
            query.search,
            "Ticket search",
            MAX_TICKET_SEARCH_LENGTH
        );
    }

    if (
        query.sort !== undefined &&
        (
            query.sortBy !== undefined ||
            query.sortOrder !== undefined
        )
    ) {
        throwValidationError(
            "Use sort or sortBy/sortOrder, not both"
        );
    }

    if (query.sort !== undefined) {
        const sort = normalizeEnum(
            query.sort,
            "Ticket queue sort",
            [...TICKET_QUEUE_SORTS]
        );

        result.sort = sort;

        
    }
        String(
            
        )
            .trim()
            .toLowerCase()

    if (
        !TICKET_QUEUE_VIEWS.has(view)
    ) {
        throw new AppError(
            "Invalid ticket queue view",
            400
        );
    }

    const rawStatus =
        String(
            query.status ?? "all"
        )
            .trim()
            .toLowerCase();

    const status =
        rawStatus === "all"
            ? null
            : rawStatus;

    if (
        status &&
        !TICKET_STATUS_VALUES.includes(
            status
        )
    ) {
        throw new AppError(
            "Invalid ticket status filter",
            400
        );
    }

    const rawPriority =
        String(
            query.priority ?? "all"
        )
            .trim()
            .toLowerCase();

    const priority =
        rawPriority === "all"
            ? null
            : rawPriority;

    if (
        priority &&
        !TICKET_PRIORITY_VALUES.includes(
            priority
        )
    ) {
        throw new AppError(
            "Invalid ticket prioirty filter",
            400
        );
    }

    const search =
        String(
            query.search ?? ""
        ).trim();

    if (
        search.length >
        MAX_TICKET_SEARCH_LENGTH
    ) {
        throw new AppError(
            `Ticket search cannot exceed ${MAX_TICKET_SEARCH_LENGTH} characters`,
            400
        );
    }

    const sort =
        String(
            query.sort ??
            "updated_desc"
        )
            .trim()
            .toLowerCase();

    if (
        !TICKET_QUEUE_SORTS.has(sort)
    ) {
        throw new AppError(
            "Invalid ticket sort option",
            400
        );
    }

    const page =
        Number.parseInt(
            query.page ?? DEFAULT_TICKET_PAGE,
            10
        );

    if (
        !Number.isInteger(page) ||
        page < 1
    ) {
        throw new AppError(
            "Ticket page must be a positive integer",
            400
        );
    }

    const limit =
        Number.parseInt(
            query.limit ??
            DEFAULT_TICKET_LIMIT,
            10
        );

    if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > MAX_TICKET_LIMIT
    ) {
        throw new AppError(
            `Ticket limit must be between 1 and ${MAX_TICKET_LIMIT}`,
            400
        );
    }

    return {
        view,
        status,
        priority,
        search,
        sort,
        page,
        limit,
    };
}