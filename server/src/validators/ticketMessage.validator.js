import AppError from "../utils/AppError.js";

import {
    TICKET_MESSAGE_LIMITS,
    TICKET_MESSAGE_TYPE_VALUES,
} from "../constants/ticketMessage.constants.js";

const CREATE_MESSAGE_FIELDS = new Set([
    "type",
    "body",
]);

const UPDATE_MESSAGE_FIELDS = new Set([
    "body",
]);

const LIST_MESSAGE_QUERY_FIELDS = new Set([
    "page",
    "limit",
    "type",
    "sortOrder",
]);

function assertObject(value, label) {
    if (
        value === null ||
        value === undefined ||
        typeof value !== "object" ||
        Array.isArray(value)
    ) {
        throw new AppError(
            `${label} must be an object`,
            400
        );
    }
}

function assertAllowedFields(
    input,
    allowedFields,
    label
) {
    const unsupportedFields =
        Object.keys(input).filter(
            (field) => !allowedFields.has(field)
        );

    if (unsupportedFields.length > 0) {
        throw new AppError(
            `Unsupported ${label} fields: ${unsupportedFields.join(", ")}`,
            400
        );
    }
}

function normalizeMessageType(
    value,
    {
        required = true,
    } = {}
) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        if (required) {
            throw new AppError(
                "Ticket message type is required",
                400
            );
        }

        return undefined;
    }

    if (typeof value !== "string") {
        throw new AppError(
            "Ticket message type must be a string",
            400
        );
    }

    const normalizedValue =
        value.trim().toLowerCase();

    if (
        !TICKET_MESSAGE_TYPE_VALUES.includes(
            normalizedValue
        )
    ) {
        throw new AppError(
            "Ticket message type must be public_reply or internal_note",
            400
        );
    }

    return normalizedValue;
}

function normalizeMessageBody(value) {
    if (
        value === undefined ||
        value === null
    ) {
        throw new AppError(
            "Ticket message body is required",
            400
        );
    }

    if (typeof value !== "string") {
        throw new AppError(
            "Ticket message body must be a string",
            400
        );
    }

    const normalizedValue = value.trim();

    if (
        normalizedValue.length <
        TICKET_MESSAGE_LIMITS.BODY_MIN_LENGTH
    ) {
        throw new AppError(
            "Ticket message body cannot be empty",
            400
        );
    }

    if (
        normalizedValue.length >
        TICKET_MESSAGE_LIMITS.BODY_MAX_LENGTH
    ) {
        throw new AppError(
            `Ticket message body cannot exceed ${TICKET_MESSAGE_LIMITS.BODY_MAX_LENGTH} characters`,
            400
        );
    }

    return normalizedValue;
}

function parsePositiveInteger({
    value,
    fieldName,
    defaultValue,
    maximumValue,
}) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return defaultValue;
    }

    const parsedValue = Number(value);

    if (
        !Number.isInteger(parsedValue) ||
        parsedValue < 1
    ) {
        throw new AppError(
            `${fieldName} must be a positive integer`,
            400
        );
    }

    if (
        maximumValue !== undefined &&
        parsedValue > maximumValue
    ) {
        throw new AppError(
            `${fieldName} cannot exceed ${maximumValue}`,
            400
        );
    }

    return parsedValue;
}

function normalizeSortOrder(value) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return "asc";
    }

    if (typeof value !== "string") {
        throw new AppError(
            "sortOrder must be a string",
            400
        );
    }

    const normalizedValue =
        value.trim().toLowerCase();

    if (
        normalizedValue !== "asc" &&
        normalizedValue !== "desc"
    ) {
        throw new AppError(
            "sortOrder must be asc or desc",
            400
        );
    }

    return normalizedValue;
}

export function validateCreateTicketMessageInput(
    input
) {
    assertObject(input, "Ticket message input");

    assertAllowedFields(
        input,
        CREATE_MESSAGE_FIELDS,
        "ticket message"
    );

    return {
        type: normalizeMessageType(input.type),

        body: normalizeMessageBody(
            input.body
        ),
    };
}

export function validateUpdateTicketMessageInput(
    input
) {
    assertObject(
        input,
        "Ticket message update input"
    );

    assertAllowedFields(
        input,
        UPDATE_MESSAGE_FIELDS,
        "ticket message update"
    );

    if (Object.keys(input).length === 0) {
        throw new AppError(
            "A ticket message body must be provided",
            400
        );
    }

    return {
        body: normalizeMessageBody(
            input.body
        ),
    };
}

export function validateTicketMessageListQuery(
    query = {}
) {
    assertObject(
        query,
        "Ticket message list query"
    );

    assertAllowedFields(
        query,
        LIST_MESSAGE_QUERY_FIELDS,
        "ticket message query"
    );

    const page = parsePositiveInteger({
        value: query.page,
        fieldName: "page",
        defaultValue: 1,
    });

    const limit = parsePositiveInteger({
        value: query.limit,
        fieldName: "limit",
        defaultValue:
            TICKET_MESSAGE_LIMITS.DEFAULT_PAGE_SIZE,

        maximumValue:
            TICKET_MESSAGE_LIMITS.MAX_PAGE_SIZE,
    });

    const type = normalizeMessageType(
        query.type,
        {
            required: false,
        }
    );

    const sortOrder =
        normalizeSortOrder(query.sortOrder);

    return {
        page,
        limit,
        type,
        sortOrder,
    };
}