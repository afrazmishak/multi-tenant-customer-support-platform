import AppError from "../utils/AppError.js";
import {
    asyncHandler,
} from "../utils/asyncHandler.js";

import {
    listTicketActivities,
} from "../services/ticketActivity.service.js";

function getWorkspaceIdFromRequest(
    req
) {
    const workspaceId =
        req.tenantContext
            ?.workspace
            ?.id ??
        req.tenantContext
            ?.tenantId;

    if (!workspaceId) {
        throw new AppError(
            "Workspace context is missing from the request",
            500
        );
    }

    return workspaceId;
}

function getTicketIdFromRequest(
    req
) {
    const { ticketId } =
        req.params;

    if (!ticketId) {
        throw new AppError(
            "Ticket ID is missing from the request",
            400
        );
    }

    return ticketId;
}

export const listTicketActivitiesController =
    asyncHandler(
        async (
            req,
            res
        ) => {
            const workspaceId =
                getWorkspaceIdFromRequest(
                    req
                );

            const ticketId =
                getTicketIdFromRequest(
                    req
                );

            const result =
                await listTicketActivities({
                    workspaceId,
                    ticketId,
                    query:
                        req.query,
                });

            res.status(
                200
            ).json({
                success:
                    true,

                data: {
                    activities:
                        result.activities,

                    pagination:
                        result.pagination,

                    filters:
                        result.filters,
                },
            });
        }
    );