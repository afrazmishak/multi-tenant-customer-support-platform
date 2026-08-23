export function getWorkspaceRoom(tenantId) {
    if (!tenantId) {
        throw new Error(
            "A tenant ID is required to create a workspace room"
        );
    }

    return `workspace:${tenantId}`;
}