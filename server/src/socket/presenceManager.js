const workspacePresence = new Map();

function getWorkspacePresence(tenantId) {
    const workspaceKey = String(tenantId);

    if (!workspacePresence.has(workspaceKey)) {
        workspacePresence.set(
            workspaceKey,
            new Map()
        );
    }

    return workspacePresence.get(workspaceKey);
}


export function addUserSocket({
    tenantId,
    userId,
    socketId,
}) {
    const users = getWorkspacePresence(tenantId);
    const userKey = String(userId);

    if (!users.has(userKey)) {
        users.set(
            userKey,
            new Set()
        );
    }

    const sockets = users.get(userKey);

    sockets.add(socketId);

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


export function getOnlineUserIds(tenantId) {
    const workspaceKey = String(tenantId);

    const users = workspacePresence.get(workspaceKey);

    if (!users) {
        return [];
    }

    return [...users.keys()];
}