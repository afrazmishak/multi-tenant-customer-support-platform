const API_BASE_URL = (
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api"
).replace(/\/+$/, "");

export async function getWorkspaceTicketsRequest(
    workspaceSlug,
    { signal } = {}
) {
    const url =
        `${API_BASE_URL}/workspaces/` +
        `${encodeURIComponent(workspaceSlug)}/tickets`;

    const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        signal,
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result?.message ||
            `Unable to load tickets (${response.status})`
        );
    }

    return result;
}

export async function getTicketByIdRequest(
    workspaceSlug,
    ticketId,
    { signal } = {}
) {
    if (!workspaceSlug || !ticketId) {
        throw new Error("Workspace slug and ticket ID are required");
    }

    const url =
        `${API_BASE_URL}/workspaces/` +
        `${encodeURIComponent(workspaceSlug)}/tickets/` +
        `${encodeURIComponent(ticketId)}`;

    const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        signal,
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result?.message ||
            result?.error?.message ||
            `Unable to load ticket (${response.status})`
        );
    }

    return result;
}

export async function getTicketActivitiesRequest(
    workspaceSlug,
    ticketId,
    {
        signal,
    } = {}
) {
    const url =
        `${API_BASE_URL}/workspaces/` +
        `${encodeURIComponent(workspaceSlug)}/tickets/` +
        `${encodeURIComponent(ticketId)}/activities`;

    const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        signal,
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result?.message ||
            `Unable to load ticket activities (${response.status})`
        );
    }

    return result;
}

export async function updateTicketAssignmentRequest(
    workspaceSlug,
    ticketId,
    input
) {
    const url =
        `${API_BASE_URL}/workspaces/` +
        `${encodeURIComponent(workspaceSlug)}/tickets/` +
        `${encodeURIComponent(ticketId)}/assignment`;

    const response = await fetch(url, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(input),
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result?.message ||
            `Unable to update ticket assignment (${response.status})`
        );
    }

    return result;
}

export async function updateTicketStatusRequest(
    workspaceSlug,
    ticketId,
    input
) {
    const url =
        `${API_BASE_URL}/workspaces/` +
        `${encodeURIComponent(workspaceSlug)}/tickets/` +
        `${encodeURIComponent(ticketId)}/status`;

    const response = await fetch(url, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(input),
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result?.message ||
            `Unable to update ticket status (${response.status})`
        );
    }

    return result;
}

export async function updateTicketRequest(
    workspaceSlug,
    ticketId,
    input
) {
    const url =
        `${API_BASE_URL}/workspaces/` +
        `${encodeURIComponent(workspaceSlug)}/tickets/` +
        `${encodeURIComponent(ticketId)}`;

    const response = await fetch(url, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(input),
    });

    const result =
        await response.json();

    if (!response.ok) {
        throw new Error(
            result?.message ||
            `Unable to update ticket (${response.status})`
        );
    }

    return result;
}

export async function getWorkspaceContextRequest(
    workspaceSlug,
    { signal } = {}
) {
    if (!workspaceSlug) {
        throw new Error("Workspace slug is required");
    }

    const url =
        `${API_BASE_URL}/workspaces/` +
        `${encodeURIComponent(workspaceSlug)}/context`;

    const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        signal,

    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result?.message ||
            result?.error?.message ||
            `Unable to load workspace context (${response.status})`
        );
    }

    return result;
}