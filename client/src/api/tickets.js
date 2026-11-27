import {
    getWorkspaceTicketsRequest,
} from "./ticketApi.js";

export async function fetchTickets({
    workspaceSlug,
    view = "active",
    page = 1,
    limit = 25,
    sort = "updated_desc",
    search = "",
    priority = "",
    status = "",
    signal,
} = {}) {
    const response = 
        await getWorkspaceTicketsRequest(
            workspaceSlug,
            {
                view,
                page,
                limit,
                sort,
                search,
                priority,
                status,
                signal,
            }
        );

    const result = response?.data;

    if (
        !Array.isArray(result?.tickets) ||
        !result?.pagination
    ) {
        throw new Error(
            "Unexpected ticket queue response structure"
        );
    }
    return result;
}