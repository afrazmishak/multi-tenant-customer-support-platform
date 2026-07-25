import { apiRequest } from "./apiClient.js"

export function getWorkspaceContextRequest(workspaceSlug) {
    return apiRequest(
        `/workspaces/${encodeURIComponent(
            workspaceSlug
        )}/context`,
        {
            method: "GET",
        }
    );
}

export function getWorkspaceMembersRequest(workspaceSlug) {
    return apiRequest(
        `/workspaces/${encodeURIComponent(
            workspaceSlug
        )}/members`,
        {
            method: "GET",
        }
    );
}