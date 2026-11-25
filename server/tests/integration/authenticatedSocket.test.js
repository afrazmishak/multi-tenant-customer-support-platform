import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import request from "supertest";
import { io as createSocketClient } from "socket.io-client";

import app from "../../src/app.js";

import {
    initializeModels,
} from "../../src/models/index.js";

import {
    MEMBERSHIP_ROLES
} from "../../src/constants/membership.constants.js";

import {
    initializeSocketServer,
} from "../../src/socket/socket.js";

import {
    emitTicketUpdated,
} from "../../src/socket/ticketRealtime.js";

import {
    getWorkspaceRoom,
} from "../../src/socket/socketRooms.js";

import {
    withIsolatedDatabase,
} from "../helpers/withIsolatedDatabase.js";

import {
    createTestUser,
    createTestWorkspace,
    createTestMembership,
} from "../helpers/createTestWorkspace.js";

function attemptConnection(socket) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error("Socket connection timed out"));
        }, 8000);

        function cleanup() {
            clearTimeout(timer);
            socket.off("connect", onConnect);
            socket.off("connect_error", onError);
        }

        function onConnect() {
            cleanup();
            resolve({ connected: true });
        }

        function onError(error) {
            cleanup();
            resolve({ connected: false, error });
        }

        socket.once("connect", onConnect);
        socket.once("connect_error", onError);
        socket.connect();
    })
}

function waitForEvent(socket, event) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.off(event, onEvent);
            reject(new Error(`Timed out waiting for ${event}`));
        }, 5000);

        function onEvent(payload) {
            clearTimeout(timer);
            socket.off(event, onEvent);
            resolve(payload);
        }

        socket.on(event, onEvent);
    });
}

async function loginAndGetCookie(server, email, password) {
    const response = await request(server)
        .post("/api/auth/login")
        .send({ email, password });

    assert.equal(
        response.status,
        200,
        JSON.stringify(response.body)
    );

    const cookies = response.headers["set-cookie"];

    assert.ok(
        Array.isArray(cookies) && cookies.length > 0,
        "Login must return a session cookie"
    );

    return cookies[0].split(";")[0];
}

test("authenticated Socket.IO delivery is tenant-isolated", async () => {
    const previousSecret = process.env.JWT_SECRET;

    process.env.JWT_SECRET =
        "isolated-socket-integration-secret-2026";

    try {
        await withIsolatedDatabase(async () => {
            await initializeModels();

            const password = "TestPassword123";

            const userA = await createTestUser({
                name: "Realtime Owner A",
                email: "realtime-a@test.example",
                password,
            });

            const userB = await createTestUser({
                name: "Realtime Owner B",
                email: "realtime-b@test.example",
                password,
            });

            const workspaceA = await createTestWorkspace({
                name: "Realtime Workspace A",
                slug: "realtime-workspace-a",
                createdBy: userA._id,
            });

            const workspaceB = await createTestWorkspace({
                name: "Realtime Workspace B",
                slug: "realtime-workspace-b",
                createdBy: userB._id,
            });

            await createTestMembership({
                tenantId: workspaceA._id,
                userId: userA._id,
                role: MEMBERSHIP_ROLES.OWNER,
            });

            await createTestMembership({
                tenantId: workspaceB._id,
                userId: userB._id,
                role: MEMBERSHIP_ROLES.OWNER,
            });

            const httpServer = http.createServer(app);
            let ioServer = null;

            const clients = [];

            try {
                ioServer = initializeSocketServer(httpServer);

                await new Promise((resolve, reject) => {
                    httpServer.once("error", reject);

                    httpServer.listen(0, "127.0.0.1", () => {
                        httpServer.off("error", reject);
                        resolve();
                    });
                });

                const port = httpServer.address().port;
                const url = `http://127.0.0.1:${port}`;

                const cookieA = await loginAndGetCookie(
                    httpServer, userA.email, password
                );

                const cookieB = await loginAndGetCookie(
                    httpServer, userB.email, password
                );

                function newClient(workspaceSlug, cookieHeader) {
                    const socket = createSocketClient(url, {
                        autoConnect: false,
                        forceNew: true,
                        reconnection: false,
                        transports: ["websocket"],
                        auth: { workspaceSlug },
                        extraHeaders: cookieHeader
                            ? { Cookie: cookieHeader }
                            : {},
                    });

                    clients.push(socket);
                    return socket;
                }

                // Test 1: Authorized connections.
                const socketA = newClient(
                    workspaceA.slug, cookieA
                );

                const socketB = newClient(
                    workspaceB.slug, cookieB
                );


                assert.equal(
                    (await attemptConnection(socketA)).connected,
                    true,
                    "Workspace A client should connect"
                );


                assert.equal(
                    (await attemptConnection(socketB)).connected,
                    true,
                    "Workspace B client should connect"
                );

                // Test 2: No cookie must be rejected.
                const anonymous = newClient(workspaceA.slug);

                const anonymousResult = await attemptConnection(anonymous);

                assert.equal(anonymousResult.connected, false);

                assert.equal(
                    anonymousResult.error?.data?.code,
                    "AUTHENTICATION_REQUIRED"
                );

                // Test 3: User A cannot connect to Workspace B.
                const unauthorized = newClient(
                    workspaceB.slug, cookieA
                );

                const unauthorizedResult =
                    await attemptConnection(unauthorized);

                assert.equal(
                    unauthorizedResult.connected,
                    false,
                    "User A must not connect to Workspace B"
                );

                assert.equal(
                    unauthorizedResult.error?.data?.code,
                    "WORKSPACE_ACCESS_DENIED"
                );

                //  Test 4: Workspace A update reaches A, not B.
                const receivedA = [];
                const receivedB = [];

                socketA.on("ticket:updated", payload => {
                    receivedA.push(payload);
                });

                socketB.on("ticket:updated", payload => {
                    receivedB.push(payload);
                });

                const ticketA = {
                    id: "ticket-a",
                    status: "in_progress",
                };

                const eventA = waitForEvent(
                    socketA, "ticket:updated"
                );

                emitTicketUpdated({
                    workspaceId: workspaceA._id.toString(),
                    ticket: ticketA,
                });

                assert.deepEqual(
                    await eventA,
                    { ticket: ticketA }
                );

                // A barrier confirms B processed a later packet.
                const barrierB = waitForEvent(
                    socketB, "test:barrier"
                );

                ioServer.to(
                    getWorkspaceRoom(workspaceB._id.toString())
                ).emit("test:barrier", { phase: "after-A" });

                await barrierB;

                assert.equal(
                    receivedB.length,
                    0,
                    "Workspace B must not receive A's update"
                );

                // Test 5: Workspace B independently received B.
                const ticketB = {
                    id: "ticket-b",
                    status: "in_progress",
                };

                const eventB = waitForEvent(
                    socketB, "ticket:updated"
                );

                emitTicketUpdated({
                    workspaceId: workspaceB._id.toString(),
                    ticket: ticketB,
                });

                assert.deepEqual(
                    await eventB,
                    { ticket: ticketB }
                );

                const barrierA = waitForEvent(
                    socketA, "test:barrier"
                );

                ioServer.to(
                    getWorkspaceRoom(workspaceA._id.toString())
                ).emit("test:barrier", { phase: "after-B" });

                await barrierA;

                assert.deepEqual(
                    receivedA.map(p => p.ticket.id),
                    ["ticket-a"]
                );

                assert.deepEqual(
                    receivedB.map(p => p.ticket.id),
                    ["ticket-b"]
                );
            } finally {
                for (const client of clients) {
                    client.disconnect();
                }

                if (ioServer) {
                    await new Promise(resolve => {
                        ioServer.close(resolve);
                    });
                } else if (httpServer.listening) {
                    await new Promise(resolve => {
                        httpServer.close(resolve);
                    });
                }
            }
        });
    } finally {
        if (previousSecret === undefined) {
            delete process.env.JWT_SECRET;
        } else {
            process.env.JWT_SECRET = previousSecret;
        }
    }
});