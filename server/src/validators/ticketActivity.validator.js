import AppError from "../utils/AppError.js";

import {
    TICKET_ACTIVITY_LIMITS,
    TICKET_ACTIVITY_TYPE_VALUES,
} from "../constants/ticketActivity.constants.js";

const LIST_ACTIVITY_QUERY_FIELDS =
    new Set([
        "page",
        "limit",
        "type",
        "sortOrder",
    ]);

function assertObject(
    value,
    label
) {
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
            (field) =>
                !allowedFields.has(field)
        );

    if (
        unsupportedFields.length > 0
    ) {
        throw new AppError(
            `Unsupported ${label} fields: ${unsupportedFields.join(", ")}`,
            400
        );
    }
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

    const parsedValue =
        Number(value);

    if (
        !Number.isInteger(
            parsedValue
        ) ||
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

function normalizeActivityType(
    value
) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return undefined;
    }

    if (
        typeof value !== "string"
    ) {
        throw new AppError(
            "Activity type must be a string",
            400
        );
    }

    const normalizedValue =
        value.trim().toLowerCase();

    if (
        !TICKET_ACTIVITY_TYPE_VALUES.includes(
            normalizedValue
        )
    ) {
        throw new AppError(
            "Invalid ticket activity type",
            400
        );
    }

    return normalizedValue;
}

function normalizeSortOrder(
    value
) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return "asc";
    }

    if (
        typeof value !== "string"
    ) {
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

export function validateTicketActivityListQuery(
    query = {}
) {
    assertObject(
        query,
        "Ticket activity query"
    );

    assertAllowedFields(
        query,
        LIST_ACTIVITY_QUERY_FIELDS,
        "ticket activity query"
    );

    return {
        page:
            parsePositiveInteger({
                value:
                    query.page,

                fieldName:
                    "page",

                defaultValue:
                    1,
            }),

        limit:
            parsePositiveInteger({
                value:
                    query.limit,

                fieldName:
                    "limit",

                defaultValue:
                    TICKET_ACTIVITY_LIMITS.DEFAULT_PAGE_SIZE,

                maximumValue:
                    TICKET_ACTIVITY_LIMITS.MAX_PAGE_SIZE,
            }),

        type:
            normalizeActivityType(
                query.type
            ),

        sortOrder:
            normalizeSortOrder(
                query.sortOrder
            ),
    };
}