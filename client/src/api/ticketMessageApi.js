const API_BASE_URL = "http://localhost:5000";

export async function getTicketMessagesRequest(
    workspaceSlug,
    ticketId,
    { signal } = {}
) {
    const url =
        `${API_BASE_URL}/api/workspaces/` +
        `${encodeURIComponent(workspaceSlug)}/tickets/` +
        `${encodeURIComponent(ticketId)}/messages`;

    const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        signal,
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result?.message ||
            `Unable to load ticket messages (${response.status})`
        );
    }

    return result;
}

export async function createTicketMessageRequest(
    workspaceSlug,
    ticketId,
    {
        type,
        body,
    }
) {
    const url =
        `${API_BASE_URL}/api/workspaces/` +
        `${encodeURIComponent(workspaceSlug)}/tickets/` +
        `${encodeURIComponent(ticketId)}/messages`;

    const response = await fetch(url, {
        method: "POST",

        headers: {
            "Content-Type": "application/json",
        },

        credentials: "include",

        body: JSON.stringify({
            type,
            body,
        }),
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result?.message ||
            `Unable to create message (${response.status})`
        );
    }

    return result;
}

export async function updateTicketMessageRequest(
    workspaceSlug,
    ticketId,
    messageId,
    {
        body,
    }
) {
    const url =
        `${API_BASE_URL}/api/workspaces/` +
        `${encodeURIComponent(workspaceSlug)}/tickets/` +
        `${encodeURIComponent(ticketId)}/messages/` +
        `${encodeURIComponent(messageId)}`;

    const response = await fetch(url, {
        method: "PATCH",

        headers: {
            "Content-Type": "application/json",
        },

        credentials: "include",

        body: JSON.stringify({
            body,
        }),
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result?.message ||
            `Unable to update message (${response.status})`
        );
    }

    return result;
}