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

export function removeUserSocket({
    tenantId,
    userId,
    socketId,
}) {
    const users = workspacePresence.get(tenantId);

    if (!users) {
        return 0;
    }

    const sockets = users.get(userId);

    if (!sockets) {
        return 0;
    }

    sockets.delete(socketId);

    if (sockets.size === 0) {
        users.delete(userId);
    }

    if (users.size === 0) {
        workspacePresence.delete(tenantId);
    }

    return sockets.size;
}