const API_BASE_URL = 
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api";

export async function fetchTickets({
    workspaceSlug,
    view = "active",
    page = 1,
    limit = 25,
    sort = "updated_desc",
    search = "",
    priority = "",
    status = "",
} = {}) {
    if (!workspaceSlug) {
        throw new Error("Workspace slug is required");
    }

    const params = new URLSearchParams({
        view,
        page: String(page),
        limit: String(limit),
        sort,
    });

    if (search.trim()) {
        params.set("search", search.trim());
    }

    if (priority) {
        params.set("priority", priority);
    }

    if (status) {
        params.set("status", status);
    }

    const url = 
        `${API_BASE_URL}/workspaces/` +
        `${encodeURIComponent(workspaceSlug)}/tickets?` +
        params.toString();

    const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
            Accept: "application/json"
        },
    });

    const body = await response.json();

    if (!response.ok) {
        throw new Error(
            body.message ||
            body.error?.message ||
            `Failed to dethc tickets (${response.status})`
        );
    }


    // Your controller may wrap the servcie output in the data
    const result = body.data ?? body;

    if (
        !Array.isArray(result.tickets) ||
        !result.pagination
    ) {
        throw new Error(
            "Unexpected ticket queue response structure"
        );
    }

    return result;
}