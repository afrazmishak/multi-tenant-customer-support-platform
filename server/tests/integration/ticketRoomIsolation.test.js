
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import request from "supertest";
import { io as createSocketClient } from "socket.io-client";

import app from "../../src/app.js";
import { initializeModels } from "../../src/models/index.js";

import Customer from "../../src/models/Customer.js";
import Ticket from "../../src/models/Ticket.js";

import {
    MEMBERSHIP_ROLES,
} from "../../src/constants/membership.constants.js";

import {
    initializeSocketServer,
} from "../../src/socket/socket.js";

import {
    emitTicketActivityChanged,
} from "../../src/socket/ticketRealtime.js";

import {
    getTicketRoom,
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

async function getLoginCookie(server, email, password) {
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
        "Login must return a cookie"
    );

    return cookies[0].split(";")[0];
}

function connectSocket(socket) {
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
            resolve();
        }

        function onError(error) {
            cleanup();
            reject(error);
        }

        socket.once("connect", onConnect);
        socket.once("connect_error", onError);

        socket.connect();
    });
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

test("ticket room subscriptions enforce tenant isolation", async () => {
    const previousSecret = process.env.JWT_SECRET;

    process.env.JWT_SECRET =
        "isolated-ticket-room-test-secret-2026";

    try {
        await withIsolatedDatabase(async () => {
            await initializeModels();

            await Promise.all([
                Customer.init(),
                Ticket.init(),
            ]);

            const password = "TestPassword123!";

            const userA = await createTestUser({
                name: "Room Owner A",
                email: "room-a@test.example",
                password,
            });

            const userB = await createTestUser({
                name: "Room Owner B",
                email: "room-b@test.example",
                password,
            });

            const workspaceA = await createTestWorkspace({
                name: "Room Workspace A",
                slug: "room-workspace-a",
                createdBy: userA._id,
            });

            const workspaceB = await createTestWorkspace({
                name: "Room Workspace B",
                slug: "room-workspace-b",
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

            const customerA = await Customer.create({
                workspace: workspaceA._id,
                name: "Room Customer A",
                createdBy: userA._id,
            });

            const customerB = await Customer.create({
                workspace: workspaceB._id,
                name: "Room Customer B",
                createdBy: userB._id,
            });

            const ticketA = await Ticket.create({
                workspace: workspaceA._id,
                ticketNumber: 1,
                customer: customerA._id,
                subject: "Room Ticket A",
                description: "Belongs to Workspace A",
                createdBy: userA._id,
            });

            const ticketB = await Ticket.create({
                workspace: workspaceB._id,
                ticketNumber: 1,
                customer: customerB._id,
                subject: "Room Ticket B",
                description: "Belongs to Workspace B",
                createdBy: userB._id,
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

                const cookieA = await getLoginCookie(
                    httpServer, userA.email, password
                );

                const cookieB = await getLoginCookie(
                    httpServer, userB.email, password
                );

                function newClient(slug, cookie) {
                    const socket = createSocketClient(url, {
                        autoConnect: false,
                        reconnection: false,
                        forceNew: true,
                        transports: ["websocket"],
                        auth: { workspaceSlug: slug },
                        extraHeaders: { Cookie: cookie },
                    });

                    clients.push(socket);
                    return socket;
                }

                const socketA = newClient(
                    workspaceA.slug, cookieA
                );

                const socketB = newClient(
                    workspaceB.slug, cookieB
                );

                await connectSocket(socketA);
                await connectSocket(socketB);

                const workspaceIdA =
                    workspaceA._id.toString();

                const workspaceIdB =
                    workspaceB._id.toString();

                const ticketIdA = ticketA._id.toString();
                const ticketIdB = ticketB._id.toString();

                const roomA = getTicketRoom(
                    workspaceIdA, ticketIdA
                );

                const roomB = getTicketRoom(
                    workspaceIdB, ticketIdB
                );

                // 1. Both users join their own ticket rooms.
                const joinA = await socketA
                    .timeout(5000)
                    .emitWithAck("ticket:join", {
                        ticketId: ticketIdA,
                    });

                assert.equal(joinA.success, true);
                assert.equal(joinA.room, roomA);

                const joinB = await socketB
                    .timeout(5000)
                    .emitWithAck("ticket:join", {
                        ticketId: ticketIdB,
                    });

                assert.equal(joinB.success, true);
                assert.equal(joinB.room, roomB);

                // 2. User A attempts to join Ticket B.
                const foreignJoin = await socketA
                    .timeout(5000)
                    .emitWithAck("ticket:join", {
                        ticketId: ticketIdB,
                    });

                assert.equal(foreignJoin.success, false);
                assert.equal(
                    foreignJoin.code,
                    "TICKET_SUBSCRIPTION_FAILED"
                );

                // 3. Verify A was not added to B's room.
                const adapter = ioServer.of("/").adapter;

                assert.equal(
                    adapter.rooms.get(roomB)?.has(socketA.id) ??
                        false,
                    false,
                    "User A must not join Ticket B's room"
                );

                assert.equal(
                    adapter.rooms.get(roomB)?.has(socketB.id),
                    true,
                    "User B should remain in Ticket B's room"
                );

                // 4. Verify Ticket A's activity reaches A.
                const receivedByB = [];

                socketB.on(
                    "ticket:activity:changed",
                    payload => receivedByB.push(payload)
                );

                const eventA = waitForEvent(
                    socketA,
                    "ticket:activity:changed"
                );

                emitTicketActivityChanged({
                    workspaceId: workspaceIdA,
                    ticketId: ticketIdA,
                });

                assert.deepEqual(await eventA, {
                    ticketId: ticketIdA,
                });

                // Ensure B processed a subsequent packet.
                const barrierB = waitForEvent(
                    socketB, "test:barrier"
                );

                ioServer.to(
                    getWorkspaceRoom(workspaceIdB)
                ).emit("test:barrier", { phase: "after-A" });

                await barrierB;

                assert.equal(
                    receivedByB.length,
                    0,
                    "User B must not receive Ticket A activity"
                );

                // 5. Leaving a ticket room must work.
                const leaveA = await socketA
                    .timeout(5000)
                    .emitWithAck("ticket:leave", {
                        ticketId: ticketIdA,
                    });

                assert.equal(leaveA.success, true);

                assert.equal(
                    adapter.rooms.get(roomA)?.has(socketA.id) ??
                        false,
                    false,
                    "User A must leave Ticket A's room"
                );

                const receivedByA = [];

                socketA.on(
                    "ticket:activity:changed",
                    payload => receivedByA.push(payload)
                );

                emitTicketActivityChanged({
                    workspaceId: workspaceIdA,
                    ticketId: ticketIdA,
                });

                const barrierA = waitForEvent(
                    socketA, "test:barrier"
                );

                ioServer.to(
                    getWorkspaceRoom(workspaceIdA)
                ).emit("test:barrier", { phase: "after-leave" });

                await barrierA;

                assert.equal(
                    receivedByA.length,
                    0,
                    "User A must not receive activity after leaving"
                );

            } finally {
                for (const socket of clients) {
                    socket.disconnect();
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
