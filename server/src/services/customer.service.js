import mongoose from "mongoose";

import Customer from "../models/Customer.js";
import AppError from "../utils/AppError.js";

import {
    validateCreateCustomerInput,
    validateCustomerListQuery,
    validateUpdateCustomerInput,
} from "../validators/customer.validator.js";

const CUSTOMER_SEARCH_FIELDS = [
    "name",
    "email",
    "phone",
    "company",
    "jobTitle",
];

function normalizeObjectId(value, fieldName) {
    if (value instanceof mongoose.Types.ObjectId) {
        return value;
    }

    if (
        typeof value !== "string" ||
        !/^[a-fA-F0-9]{24}$/.test(value)
    ) {
        throw new AppError(
            `${fieldName} must be a valid identifier`,
            400
        );
    }

    return new mongoose.Types.ObjectId(value);
}

function escapeRegularExpression(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDuplicateKeyError(error) {
    return error?.code === 11000;
}

function isDuplicateCustomerEmailError(error) {
    if (!isDuplicateKeyError(error)) {
        return false;
    }

    return Boolean(
        error?.keyPattern?.email ||
        error?.keyValue?.email ||
        error?.message?.includes(
            "unique_active_customer_email_per_workspace"
        )
    );
}

function handleCustomerPersistenceError(error, email = null) {
    if (isDuplicateCustomerEmailError(error)) {
        throw new AppError(
            email
                ? `An active customer with the email ${email} already exists in this workspace`
                : "An active customer with this email already exists in this workspace",
            409
        );
    }

    if (error?.name === "VersionError") {
        throw new AppError(
            "This customer was modified by another request. Refresh the customer and try again.",
            409
        );
    }

    throw error;
}

function buildCustomerFilter(workspaceId, options) {
    const filter = {
        workspace: workspaceId,
        isArchived: options.isArchived,
    };

    if (options.status) {
        filter.status = options.status;
    }

    if (options.tags.length > 0) {
        filter.tags = {
            $all: options.tags,
        };
    }

    if (options.search) {
        const escapedSearch = escapeRegularExpression(
            options.search
        );

        const searchExpression = new RegExp(
            escapedSearch,
            "i"
        );

        filter.$or = CUSTOMER_SEARCH_FIELDS.map(
            (fieldName) => ({
                [fieldName]: searchExpression,
            })
        );
    }

    return filter;
}

function buildCustomerSort(sortBy, sortOrder) {
    return {
        [sortBy]: sortOrder,
        _id: sortOrder,
    };
}

async function findCustomerDocument({
    workspaceId,
    customerId,
}) {
    const customer = await Customer.findOne({
        _id: customerId,
        workspace: workspaceId,
    });

    if (!customer) {
        throw new AppError(
            "Customer was not found in this workspace",
            404
        );
    }

    return customer;
}

async function assertCustomerEmailAvailable({
    workspaceId,
    email,
    excludeCustomerId = null,
}) {
    if (!email) {
        return;
    }

    const filter = {
        workspace: workspaceId,
        email,
        isArchived: false,
    };

    if (excludeCustomerId) {
        filter._id = {
            $ne: excludeCustomerId,
        };
    }

    const existingCustomer = await Customer.exists(filter);

    if (existingCustomer) {
        throw new AppError(
            `An active customer with the email ${email} already exists in this workspace`,
            409
        );
    }
}

export async function createCustomer({
    workspaceId,
    actorUserId,
    input,
}) {
    const normalizedWorkspaceId = normalizeObjectId(
        workspaceId,
        "Workspace ID"
    );

    const normalizedActorUserId = normalizeObjectId(
        actorUserId,
        "User ID"
    );

    const validatedInput =
        validateCreateCustomerInput(input);

    await assertCustomerEmailAvailable({
        workspaceId: normalizedWorkspaceId,
        email: validatedInput.email,
    });

    try {
        const customer = new Customer({
            ...validatedInput,
            workspace: normalizedWorkspaceId,
            createdBy: normalizedActorUserId,
            updatedBy: normalizedActorUserId,
        });

        await customer.save();

        return customer.toObject();
    } catch (error) {
        handleCustomerPersistenceError(
            error,
            validatedInput.email
        );
    }
}

export async function listCustomers({
    workspaceId,
    query = {},
}) {
    const normalizedWorkspaceId = normalizeObjectId(
        workspaceId,
        "Workspace ID"
    );

    const options = validateCustomerListQuery(query);

    const filter = buildCustomerFilter(
        normalizedWorkspaceId,
        options
    );

    const sort = buildCustomerSort(
        options.sortBy,
        options.sortOrder
    );

    const [customers, totalCustomers] =
        await Promise.all([
            Customer.find(filter)
                .sort(sort)
                .skip(options.skip)
                .limit(options.limit)
                .lean(),

            Customer.countDocuments(filter),
        ]);

    const totalPages = Math.ceil(
        totalCustomers / options.limit
    );

    return {
        customers,
        pagination: {
            page: options.page,
            limit: options.limit,
            totalCustomers,
            totalPages,
            hasPreviousPage: options.page > 1,
            hasNextPage: options.page < totalPages,
        },
        filters: {
            status: options.status ?? null,
            isArchived: options.isArchived,
            search: options.search,
            tags: options.tags,
            sortBy: options.sortBy,
            sortOrder:
                options.sortOrder === 1 ? "asc" : "desc",
        },
    };
}

export async function getCustomerById({
    workspaceId,
    customerId,
    includeArchived = false,
}) {
    const normalizedWorkspaceId = normalizeObjectId(
        workspaceId,
        "Workspace ID"
    );

    const normalizedCustomerId = normalizeObjectId(
        customerId,
        "Customer ID"
    );

    if (typeof includeArchived !== "boolean") {
        throw new AppError(
            "includeArchived must be true or false",
            400
        );
    }

    const filter = {
        _id: normalizedCustomerId,
        workspace: normalizedWorkspaceId,
    };

    if (!includeArchived) {
        filter.isArchived = false;
    }

    const customer = await Customer.findOne(filter).lean();

    if (!customer) {
        throw new AppError(
            "Customer was not found in this workspace",
            404
        );
    }

    return customer;
}

export async function updateCustomer({
    workspaceId,
    customerId,
    actorUserId,
    input,
}) {
    const normalizedWorkspaceId = normalizeObjectId(
        workspaceId,
        "Workspace ID"
    );

    const normalizedCustomerId = normalizeObjectId(
        customerId,
        "Customer ID"
    );

    const normalizedActorUserId = normalizeObjectId(
        actorUserId,
        "User ID"
    );

    const validatedInput =
        validateUpdateCustomerInput(input);

    const customer = await findCustomerDocument({
        workspaceId: normalizedWorkspaceId,
        customerId: normalizedCustomerId,
    });

    if (customer.isArchived) {
        throw new AppError(
            "Archived customers cannot be updated. Restore the customer first.",
            409
        );
    }

    const emailIsChanging =
        Object.prototype.hasOwnProperty.call(
            validatedInput,
            "email"
        ) &&
        validatedInput.email !== customer.email;

    if (emailIsChanging) {
        await assertCustomerEmailAvailable({
            workspaceId: normalizedWorkspaceId,
            email: validatedInput.email,
            excludeCustomerId: normalizedCustomerId,
        });
    }

    customer.set(validatedInput);
    customer.updatedBy = normalizedActorUserId;

    try {
        await customer.save();

        return customer.toObject();
    } catch (error) {
        handleCustomerPersistenceError(
            error,
            validatedInput.email
        );
    }
}

export async function archiveCustomer({
    workspaceId,
    customerId,
    actorUserId,
}) {
    const normalizedWorkspaceId = normalizeObjectId(
        workspaceId,
        "Workspace ID"
    );

    const normalizedCustomerId = normalizeObjectId(
        customerId,
        "Customer ID"
    );

    const normalizedActorUserId = normalizeObjectId(
        actorUserId,
        "User ID"
    );

    const customer = await findCustomerDocument({
        workspaceId: normalizedWorkspaceId,
        customerId: normalizedCustomerId,
    });

    if (customer.isArchived) {
        throw new AppError(
            "Customer is already archived",
            409
        );
    }

    customer.isArchived = true;
    customer.archivedAt = new Date();
    customer.archivedBy = normalizedActorUserId;
    customer.updatedBy = normalizedActorUserId;

    try {
        await customer.save();

        return customer.toObject();
    } catch (error) {
        handleCustomerPersistenceError(
            error,
            customer.email
        );
    }
}

export async function restoreCustomer({
    workspaceId,
    customerId,
    actorUserId,
}) {
    const normalizedWorkspaceId = normalizeObjectId(
        workspaceId,
        "Workspace ID"
    );

    const normalizedCustomerId = normalizeObjectId(
        customerId,
        "Customer ID"
    );

    const normalizedActorUserId = normalizeObjectId(
        actorUserId,
        "User ID"
    );

    const customer = await findCustomerDocument({
        workspaceId: normalizedWorkspaceId,
        customerId: normalizedCustomerId,
    });

    if (!customer.isArchived) {
        throw new AppError(
            "Customer is not archived",
            409
        );
    }

    await assertCustomerEmailAvailable({
        workspaceId: normalizedWorkspaceId,
        email: customer.email,
        excludeCustomerId: normalizedCustomerId,
    });

    customer.isArchived = false;
    customer.archivedAt = null;
    customer.archivedBy = null;
    customer.updatedBy = normalizedActorUserId;

    try {
        await customer.save();

        return customer.toObject();
    } catch (error) {
        handleCustomerPersistenceError(
            error,
            customer.email
        );
    }
}

