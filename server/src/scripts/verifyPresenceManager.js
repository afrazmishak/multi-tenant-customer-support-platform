
import assert from "node:assert/strict";

import {
    addUserSocket,
    removeUserSocket,
    getOnlineUserIds,
} from "../socket/presenceManager.js";

const tenantA = "presence-verification-a";
const tenantB = "presence-verification-b";

const userA = "test-user-a";
const userB = "test-user-b";

// Test 1: Empty workspace
assert.deepEqual(
    getOnlineUserIds(tenantA),
    []
);

// Test 2: User A connects
assert.equal(
    addUserSocket({
        tenantId: tenantA,
        userId: userA,
        socketId: "socket-1",
    }),
    1
);

// Test 3: Same user opens another tab
assert.equal(
    addUserSocket({
        tenantId: tenantA,
        userId: userA,
        socketId: "socket-2",
    }),
    2
);

// Still only one unique user
assert.deepEqual(
    getOnlineUserIds(tenantA),
    [userA]
);

// Test 4: Another user connects
addUserSocket({
    tenantId: tenantA,
    userId: userB,
    socketId: "socket-3",
});

assert.deepEqual(
    getOnlineUserIds(tenantA).sort(),
    [userA, userB].sort()
);

// Test 5: Same user in another tenant
addUserSocket({
    tenantId: tenantB,
    userId: userA,
    socketId: "socket-4",
});

assert.deepEqual(
    getOnlineUserIds(tenantB),
    [userA]
);

// Test 6: Close only one of User A's tabs
assert.equal(
    removeUserSocket({
        tenantId: tenantA,
        userId: userA,
        socketId: "socket-1",
    }),
    1
);

// User A must remain online in Tenant A
assert.ok(
    getOnlineUserIds(tenantA).includes(userA)
);

// Test 7: Close User A's final tab in Tenant A
assert.equal(
    removeUserSocket({
        tenantId: tenantA,
        userId: userA,
        socketId: "socket-2",
    }),
    0
);

// User A disappears from Tenant A
assert.deepEqual(
    getOnlineUserIds(tenantA),
    [userB]
);

// But remains online in Tenant B
assert.deepEqual(
    getOnlineUserIds(tenantB),
    [userA]
);

// Cleanup
removeUserSocket({
    tenantId: tenantA,
    userId: userB,
    socketId: "socket-3",
});

removeUserSocket({
    tenantId: tenantB,
    userId: userA,
    socketId: "socket-4",
});

assert.deepEqual(
    getOnlineUserIds(tenantA),
    []
);

assert.deepEqual(
    getOnlineUserIds(tenantB),
    []
);

console.log(
    "All presence verification tests passed!"
);
