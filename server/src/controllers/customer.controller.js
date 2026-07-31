import AppError from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import {
    archiveCustomer,
    createCustomer,
    getCustomerById,
    listCustomers,
    restoreCustomer,
    updateCustomer,
} from "../services/customer.service.js";

function getWorkspaceIdFromRequest(req) {
    const workspaceId =
        req.workspace?._id ??
        req.workspace?.id ??
        req.workspaceId ??
        req.workspaceContext?.workspaceId ??
        req.workspaceContext?.workspace?._id;

    if (!workspaceId) {
        throw new AppError(
            "Workspace context is missing from the request",
            500
        );
    }

    return workspaceId;
}

function getAuthenticatedUserId(req) {
    const userId =
        req.user?._id ??
        req.user?.id;

    if (!userId) {
        throw new AppError(
            "Authenticated user context is missing from the request",
            500
        );
    }

    return userId;
}

export const createCustomerController = asyncHandler(
    async (req, res) => {
        const workspaceId =
            getWorkspaceIdFromRequest(req);

        const actorUserId =
            getAuthenticatedUserId(req);

        const customer = await createCustomer({
            workspaceId,
            actorUserId,
            input: req.body,
        });

        res.status(201).json({
            success: true,
            message: "Customer created successfully",
            data: {
                customer,
            },
        });
    }
);

export const listCustomersController = asyncHandler(
    async (req, res) => {
        const workspaceId =
            getWorkspaceIdFromRequest(req);

        const result = await listCustomers({
            workspaceId,
            query: req.query,
        });

        res.status(200).json({
            success: true,
            data: {
                customers: result.customers,
                pagination: result.pagination,
                filters: result.filters,
            },
        });
    }
);

export const getCustomerController = asyncHandler(
    async (req, res) => {
        const workspaceId =
            getWorkspaceIdFromRequest(req);

        const customer = await getCustomerById({
            workspaceId,
            customerId: req.params.customerId,
            includeArchived: false,
        });

        res.status(200).json({
            success: true,
            data: {
                customer,
            },
        });
    }
);

export const updateCustomerController = asyncHandler(
    async (req, res) => {
        const workspaceId =
            getWorkspaceIdFromRequest(req);

        const actorUserId =
            getAuthenticatedUserId(req);

        const customer = await updateCustomer({
            workspaceId,
            customerId: req.params.customerId,
            actorUserId,
            input: req.body,
        });

        res.status(200).json({
            success: true,
            message: "Customer updated successfully",
            data: {
                customer,
            },
        });
    }
);

export const archiveCustomerController = asyncHandler(
    async (req, res) => {
        const workspaceId =
            getWorkspaceIdFromRequest(req);

        const actorUserId =
            getAuthenticatedUserId(req);

        const customer = await archiveCustomer({
            workspaceId,
            customerId: req.params.customerId,
            actorUserId,
        });

        res.status(200).json({
            success: true,
            message: "Customer archived successfully",
            data: {
                customer,
            },
        });
    }
);

export const restoreCustomerController = asyncHandler(
    async (req, res) => {
        const workspaceId =
            getWorkspaceIdFromRequest(req);

        const actorUserId =
            getAuthenticatedUserId(req);

        const customer = await restoreCustomer({
            workspaceId,
            customerId: req.params.customerId,
            actorUserId,
        });

        res.status(200).json({
            success: true,
            message: "Customer restored successfully",
            data: {
                customer,
            },
        });
    }
);