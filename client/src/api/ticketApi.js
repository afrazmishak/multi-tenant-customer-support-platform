const API_BASE_URL = "http://localhost:5000";

export async function getWorkspaceTicketsRequest(
    workspaceSlug,
    { signal } = {}
) {
    const url =
        `${API_BASE_URL}/api/workspaces/` +
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