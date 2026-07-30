import AppError from "../utils/AppError.js";

import {
    CUSTOMER_LIMITS,
    CUSTOMER_STATUS_VALUES,
} from "../constants/customer.constants.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CREATE_FIELDS = new Set([
    "name",
    "email",
    "phone",
    "company",
    "jobTitle",
    "status",
    "tags",
    "notes",
    "customFields",
]);

const UPDATE_FIELDS = new Set([
    "name",
    "email",
    "phone",
    "company",
    "jobTitle",
    "status",
    "tags",
    "notes",
    "customFields",
]);

const SORT_FIELDS = new Set([
    "name",
    "email",
    "company",
    "status",
    "createdAt",
    "updatedAt",
]);

const FORBIDDEN_CUSTOM_FIELD_KEYS = new Set([
    "__proto__",
    "prototype",
    "constructor",
]);

function throwValidationError(message) {
    throw new AppError(message, 400);
}

function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
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
            "Customer data must be provided as a JSON object"
        );
    }
}

function rejectUnknownFields(input, allowedFields) {
    const unknownFields = Object.keys(input).filter(
        (field) => !allowedFields.has(field)
    );

    if (unknownFields.length > 0) {
        throwValidationError(
            `Unsupported customer field${unknownFields.length === 1 ? "" : "s"
            }: ${unknownFields.join(", ")}`
        );
    }
}

function normalizeRequiredText(value, fieldName, maxLength) {
    if (typeof value !== "string") {
        throwValidationError(`${fieldName} must be a string`);
    }

    const normalizedValue = value.trim();

    if (!normalizedValue) {
        throwValidationError(`${fieldName} is required`);
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

function normalizeEmail(value) {
    const normalizedEmail = normalizeOptionalText(
        value,
        "Customer email",
        CUSTOMER_LIMITS.EMAIL_MAX_LENGTH
    );

    if (normalizedEmail === null) {
        return null;
    }

    const lowercaseEmail = normalizedEmail.toLowerCase();

    if (!EMAIL_PATTERN.test(lowercaseEmail)) {
        throwValidationError(
            "Please provide a valid customer email address"
        );
    }

    return lowercaseEmail;
}

function normalizeStatus(value) {
    if (typeof value !== "string") {
        throwValidationError(
            "Customer status must be a string"
        );
    }

    const normalizedStatus = value.trim().toLowerCase();

    if (!CUSTOMER_STATUS_VALUES.includes(normalizedStatus)) {
        throwValidationError(
            `Customer status must be one of: ${CUSTOMER_STATUS_VALUES.join(
                ", "
            )}`
        );
    }

    return normalizedStatus;
}

function normalizeTags(value) {
    if (!Array.isArray(value)) {
        throwValidationError(
            "Customer tags must be provided as an array"
        );
    }

    const normalizedTags = [];

    for (const tag of value) {
        if (typeof tag !== "string") {
            throwValidationError(
                "Every customer tag must be a string"
            );
        }

        const normalizedTag = tag.trim().toLowerCase();

        if (!normalizedTag) {
            continue;
        }

        if (
            normalizedTag.length >
            CUSTOMER_LIMITS.TAG_MAX_LENGTH
        ) {
            throwValidationError(
                `Customer tags cannot exceed ${CUSTOMER_LIMITS.TAG_MAX_LENGTH} characters`
            );
        }

        if (!normalizedTags.includes(normalizedTag)) {
            normalizedTags.push(normalizedTag);
        }
    }

    if (
        normalizedTags.length >
        CUSTOMER_LIMITS.MAX_TAGS
    ) {
        throwValidationError(
            `A customer cannot have more than ${CUSTOMER_LIMITS.MAX_TAGS} tags`
        );
    }

    return normalizedTags;
}

function validateCustomFieldValue(
    value,
    path,
    depth = 0
) {
    if (depth > CUSTOMER_LIMITS.CUSTOM_FIELD_MAX_DEPTH) {
        throwValidationError(
            `${path} exceeds the maximum nesting depth`
        );
    }

    if (value === null) {
        return;
    }

    const valueType = typeof value;

    if (
        valueType === "string" ||
        valueType === "boolean"
    ) {
        return;
    }

    if (valueType === "number") {
        if (!Number.isFinite(value)) {
            throwValidationError(
                `${path} must contain a finite number`
            );
        }

        return;
    }

    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
            validateCustomFieldValue(
                value[index],
                `${path}[${index}]`,
                depth + 1
            );
        }

        return;
    }

    if (isPlainObject(value)) {
        for (const [key, nestedValue] of Object.entries(value)) {
            validateCustomFieldValue(
                nestedValue,
                `${path}.${key}`,
                depth + 1
            );
        }

        return;
    }

    throwValidationError(
        `${path} contains an unsupported value`
    );
}

function normalizeCustomFields(value) {
    if (!isPlainObject(value)) {
        throwValidationError(
            "Customer customFields must be a JSON object"
        );
    }

    const entries = Object.entries(value);

    if (
        entries.length >
        CUSTOMER_LIMITS.MAX_CUSTOM_FIELDS
    ) {
        throwValidationError(
            `A customer cannot have more than ${CUSTOMER_LIMITS.MAX_CUSTOM_FIELDS} custom fields`
        );
    }

    const normalizedCustomFields = {};

    for (const [rawKey, fieldValue] of entries) {
        const normalizedKey = rawKey.trim();

        if (!normalizedKey) {
            throwValidationError(
                "Custom field keys cannot be empty"
            );
        }

        if (
            normalizedKey.length >
            CUSTOMER_LIMITS.CUSTOM_FIELD_KEY_MAX_LENGTH
        ) {
            throwValidationError(
                `Custom field keys cannot exceed ${CUSTOMER_LIMITS.CUSTOM_FIELD_KEY_MAX_LENGTH} characters`
            );
        }

        if (
            normalizedKey.startsWith("$") ||
            normalizedKey.includes(".") ||
            FORBIDDEN_CUSTOM_FIELD_KEYS.has(normalizedKey)
        ) {
            throwValidationError(
                `Invalid custom field key: ${normalizedKey}`
            );
        }

        if (hasOwn(normalizedCustomFields, normalizedKey)) {
            throwValidationError(
                `Duplicate custom field key: ${normalizedKey}`
            );
        }

        validateCustomFieldValue(
            fieldValue,
            `customFields.${normalizedKey}`
        );

        normalizedCustomFields[normalizedKey] = fieldValue;
    }

    const serializedCustomFields = JSON.stringify(
        normalizedCustomFields
    );

    const customFieldsSize = Buffer.byteLength(
        serializedCustomFields,
        "utf8"
    );

    if (
        customFieldsSize >
        CUSTOMER_LIMITS.CUSTOM_FIELDS_MAX_BYTES
    ) {
        throwValidationError(
            `Customer customFields cannot exceed ${CUSTOMER_LIMITS.CUSTOM_FIELDS_MAX_BYTES} bytes`
        );
    }

    return normalizedCustomFields;
}

function validateMutableCustomerFields(input) {
    const validatedInput = {};

    if (hasOwn(input, "name")) {
        validatedInput.name = normalizeRequiredText(
            input.name,
            "Customer name",
            CUSTOMER_LIMITS.NAME_MAX_LENGTH
        );
    }

    if (hasOwn(input, "email")) {
        validatedInput.email = normalizeEmail(input.email);
    }

    if (hasOwn(input, "phone")) {
        validatedInput.phone = normalizeOptionalText(
            input.phone,
            "Customer phone",
            CUSTOMER_LIMITS.PHONE_MAX_LENGTH
        );
    }

    if (hasOwn(input, "company")) {
        validatedInput.company = normalizeOptionalText(
            input.company,
            "Customer company",
            CUSTOMER_LIMITS.COMPANY_MAX_LENGTH
        );
    }

    if (hasOwn(input, "jobTitle")) {
        validatedInput.jobTitle = normalizeOptionalText(
            input.jobTitle,
            "Customer job title",
            CUSTOMER_LIMITS.JOB_TITLE_MAX_LENGTH
        );
    }

    if (hasOwn(input, "status")) {
        validatedInput.status = normalizeStatus(input.status);
    }

    if (hasOwn(input, "tags")) {
        validatedInput.tags = normalizeTags(input.tags);
    }

    if (hasOwn(input, "notes")) {
        validatedInput.notes = normalizeOptionalText(
            input.notes,
            "Customer notes",
            CUSTOMER_LIMITS.NOTES_MAX_LENGTH
        );
    }

    if (hasOwn(input, "customFields")) {
        validatedInput.customFields = normalizeCustomFields(
            input.customFields
        );
    }

    return validatedInput;
}

export function validateCreateCustomerInput(input) {
    assertRequestObject(input);
    rejectUnknownFields(input, CREATE_FIELDS);

    if (!hasOwn(input, "name")) {
        throwValidationError("Customer name is required");
    }

    return validateMutableCustomerFields(input);
}

export function validateUpdateCustomerInput(input) {
    assertRequestObject(input);
    rejectUnknownFields(input, UPDATE_FIELDS);

    if (Object.keys(input).length === 0) {
        throwValidationError(
            "At least one customer field must be provided"
        );
    }

    return validateMutableCustomerFields(input);
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

    const stringValue = String(value).trim();

    if (!/^\d+$/.test(stringValue)) {
        throwValidationError(
            `${fieldName} must be a positive integer`
        );
    }

    const parsedValue = Number(stringValue);

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

function parseBoolean(value, fieldName, defaultValue) {
    if (value === undefined) {
        return defaultValue;
    }

    if (value === true || value === "true") {
        return true;
    }

    if (value === false || value === "false") {
        return false;
    }

    throwValidationError(
        `${fieldName} must be true or false`
    );
}

function normalizeQueryTags(value) {
    if (value === undefined) {
        return [];
    }

    const tagValues = Array.isArray(value)
        ? value
        : [value];

    const separatedTags = tagValues.flatMap((tagValue) =>
        String(tagValue).split(",")
    );

    return normalizeTags(separatedTags);
}

export function validateCustomerListQuery(query = {}) {
    if (
        query === null ||
        typeof query !== "object" ||
        Array.isArray(query)
    ) {
        throwValidationError(
            "Customer query parameters are invalid"
        );
    }

    const page = parsePositiveInteger(
        query.page,
        "Page",
        1
    );

    const limit = parsePositiveInteger(
        query.limit,
        "Limit",
        CUSTOMER_LIMITS.DEFAULT_PAGE_SIZE
    );

    if (limit > CUSTOMER_LIMITS.MAX_PAGE_SIZE) {
        throwValidationError(
            `Limit cannot exceed ${CUSTOMER_LIMITS.MAX_PAGE_SIZE}`
        );
    }

    const isArchived = parseBoolean(
        query.isArchived,
        "isArchived",
        false
    );

    let status;

    if (query.status !== undefined) {
        if (Array.isArray(query.status)) {
            throwValidationError(
                "Only one customer status may be provided"
            );
        }

        status = normalizeStatus(query.status);
    }

    let search = null;

    if (query.search !== undefined) {
        if (Array.isArray(query.search)) {
            throwValidationError(
                "Only one customer search value may be provided"
            );
        }

        search = normalizeOptionalText(
            query.search,
            "Customer search",
            CUSTOMER_LIMITS.SEARCH_MAX_LENGTH
        );
    }

    const tags = normalizeQueryTags(query.tags);

    const sortBy =
        query.sortBy === undefined
            ? "createdAt"
            : String(query.sortBy).trim();

    if (!SORT_FIELDS.has(sortBy)) {
        throwValidationError(
            `sortBy must be one of: ${[
                ...SORT_FIELDS,
            ].join(", ")}`
        );
    }

    const rawSortOrder =
        query.sortOrder === undefined
            ? "desc"
            : String(query.sortOrder).trim().toLowerCase();

    if (!["asc", "desc"].includes(rawSortOrder)) {
        throwValidationError(
            "sortOrder must be either asc or desc"
        );
    }

    return {
        page,
        limit,
        skip: (page - 1) * limit,
        status,
        isArchived,
        search,
        tags,
        sortBy,
        sortOrder: rawSortOrder === "asc" ? 1 : -1,
    };
}