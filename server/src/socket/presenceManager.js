const workspacePresence = new Map();

function getWorkspacePresence(tenantId) {
    if (!workspacePresence.has(tenantId)) {
        workspacePresence.set(
            tenantId,
            new Map()
        );
    }

    return workspacePresence.get(tenantId);
}

export function addUserSocket({
    tenantId,
    userId,
    socketId,
}) {
    const users = getWorkspacePresence(tenantId);

    if (!userId.has(userId)) {
        users.set(
            userId,
            new Set()
        );
    }

    const sockets = users.get(userId);

    socketId.add(socketId);

    return sockets.size;
}