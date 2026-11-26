
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";

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
    getWorkspaceRoom,
} from "../../src/socket/socketRooms.js";

import {
    withIsolatedReplicaSet,
} from "../helpers/withIsolatedReplicaSet.js";

import {
    createTestUser,
    createTestWorkspace,
    createTestMembership,
} from "../helpers/createTestWorkspace.js";

async function loginCookie(server, email, password) {
    const response = await request(server)
        .post("/api/auth/login")
        .send({ email, password });

    assert.equal(response.status, 200);

    const cookies = response.headers["set-cookie"];

    assert.ok(
        Array.isArray(cookies) && cookies.length > 0
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

// Confirm a client has processed an event sent after
// the application's realtime broadcasts.
function flushClient(socket, ioServer, workspaceId) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.off("test:barrier", onBarrier);
            reject(new Error("Socket barrier timed out"));
        }, 5000);

        function onBarrier() {
            clearTimeout(timer);
            socket.off("test:barrier", onBarrier);
            resolve();
        }

        socket.once("test:barrier", onBarrier);

        ioServer.to(
            getWorkspaceRoom(workspaceId)
        ).emit("test:barrier", {});
    });
}

test(
    "HTTP ticket mutation emits only authorized realtime events",
    async () => {
        const previousSecret = process.env.JWT_SECRET;

        process.env.JWT_SECRET =
            "http-realtime-integration-test-secret-2026";

        try {
            await withIsolatedReplicaSet(async () => {
                await initializeModels();

                await Promise.all([
                    Customer.init(),
                    Ticket.init(),
                ]);

                const password = "TestPassword123!";

                const userA = await createTestUser({
                    name: "HTTP Realtime Owner A",
                    email: "http-realtime-a@test.example",
                    password,
                });

                const userB = await createTestUser({
                    name: "HTTP Realtime Owner B",
                    email: "http-realtime-b@test.example",
                    password,
                });

                const workspaceA = await createTestWorkspace({
                    name: "HTTP Realtime Workspace A",
                    slug: "http-realtime-a",
                    createdBy: userA._id,
                });

                const workspaceB = await createTestWorkspace({
                    name: "HTTP Realtime Workspace B",
                    slug: "http-realtime-b",
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
                    name: "HTTP Customer A",
                    createdBy: userA._id,
                });

                const customerB = await Customer.create({
                    workspace: workspaceB._id,
                    name: "HTTP Customer B",
                    createdBy: userB._id,
                });

                const ticketA = await Ticket.create({
                    workspace: workspaceA._id,
                    ticketNumber: 1,
                    customer: customerA._id,
                    subject: "HTTP Realtime Ticket A",
                    description: "Workspace A ticket",
                    createdBy: userA._id,
                });

                const ticketB = await Ticket.create({
                    workspace: workspaceB._id,
                    ticketNumber: 1,
                    customer: customerB._id,
                    subject: "HTTP Realtime Ticket B",
                    description: "Workspace B ticket",
                    createdBy: userB._id,
                });

                const httpServer = http.createServer(app);
                let ioServer = null;
                const clients = [];

                try {
                    ioServer = initializeSocketServer(httpServer);

                    await new Promise((resolve, reject) => {
                        httpServer.once("error", reject);

                        httpServer.listen(
                            0,
                            "127.0.0.1",
                            () => {
                                httpServer.off("error", reject);
                                resolve();
                            }
                        );
                    });

                    const url =
                        `http://127.0.0.1:${httpServer.address().port}`;

                    const cookieA = await loginCookie(
                        httpServer, userA.email, password
                    );

                    const cookieB = await loginCookie(
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

                    const ticketIdA =
                        ticketA._id.toString();

                    // Subscribe A to the ticket activity room.
                    const joinA = await socketA
                        .timeout(5000)
                        .emitWithAck("ticket:join", {
                            ticketId: ticketIdA,
                        });

                    assert.equal(joinA.success, true);

                    const updatesA = [];
                    const activitiesA = [];
                    const updatesB = [];
                    const activitiesB = [];

                    socketA.on("ticket:updated", payload => {
                        updatesA.push(payload);
                    });

                    socketA.on("ticket:activity:changed", payload => {
                        activitiesA.push(payload);
                    });

                    socketB.on("ticket:updated", payload => {
                        updatesB.push(payload);
                    });

                    socketB.on("ticket:activity:changed", payload => {
                        activitiesB.push(payload);
                    });

                    const TicketActivity =
                        mongoose.models.TicketActivity;

                    assert.ok(TicketActivity);

                    // 1. Authorized HTTP mutation.
                    const authorized = await request(httpServer)
                        .patch(
                            `/api/workspaces/${workspaceA.slug}` +
                            `/tickets/${ticketIdA}/status`
                        )
                        .set("Cookie", cookieA)
                        .send({ status: "in_progress" });

                    assert.equal(
                        authorized.status,
                        200,
                        JSON.stringify(authorized.body)
                    );

                    // Wait until clients process preceding events.
                    await Promise.all([
                        flushClient(
                            socketA, ioServer, workspaceIdA
                        ),
                        flushClient(
                            socketB, ioServer, workspaceIdB
                        ),
                    ]);

                    // 2. Verify database persistence.
                    const persistedA = await Ticket.findById(
                        ticketA._id
                    );

                    assert.equal(
                        persistedA.status,
                        "in_progress"
                    );

                    const activitiesAfterSuccess =
                        await TicketActivity.countDocuments({});

                    assert.ok(
                        activitiesAfterSuccess > 0,
                        "Authorized mutation must create an activity"
                    );

                    // 3. Verify actual Socket.IO delivery.
                    assert.equal(
                        updatesA.length,
                        1,
                        "A must receive one ticket update"
                    );

                    assert.equal(
                        updatesA[0].ticket.status,
                        "in_progress"
                    );

                    assert.equal(
                        activitiesA.length,
                        1,
                        "A must receive one activity notification"
                    );

                    assert.equal(
                        String(activitiesA[0].ticketId),
                        ticketIdA
                    );

                    assert.equal(
                        updatesB.length,
                        0,
                        "B must not receive A's ticket update"
                    );

                    assert.equal(
                        activitiesB.length,
                        0,
                        "B must not receive A's activity"
                    );

                    // 4. Attempt to modify foreign Ticket B.
                    const foreignBefore =
                        await Ticket.findById(ticketB._id).lean();

                    const rejected = await request(httpServer)
                        .patch(
                            `/api/workspaces/${workspaceA.slug}` +
                            `/tickets/${ticketB._id}/status`
                        )
                        .set("Cookie", cookieA)
                        .send({ status: "in_progress" });

                    assert.equal(
                        rejected.status,
                        404,
                        JSON.stringify(rejected.body)
                    );

                    // Also reject access via B's workspace URL.
                    const forbidden = await request(httpServer)
                        .patch(
                            `/api/workspaces/${workspaceB.slug}` +
                            `/tickets/${ticketB._id}/status`
                        )
                        .set("Cookie", cookieA)
                        .send({ status: "in_progress" });

                    assert.equal(
                        forbidden.status,
                        403,
                        JSON.stringify(forbidden.body)
                    );

                    await Promise.all([
                        flushClient(
                            socketA, ioServer, workspaceIdA
                        ),
                        flushClient(
                            socketB, ioServer, workspaceIdB
                        ),
                    ]);

                    // 5. No unauthorized database writes.
                    const foreignAfter =
                        await Ticket.findById(ticketB._id).lean();

                    assert.deepEqual(
                        foreignAfter,
                        foreignBefore
                    );

                    assert.equal(
                        await TicketActivity.countDocuments({}),
                        activitiesAfterSuccess,
                        "Rejected mutations must not create activities"
                    );

                    // 6. No events from rejected mutations.
                    assert.equal(updatesA.length, 1);
                    assert.equal(activitiesA.length, 1);
                    assert.equal(updatesB.length, 0);
                    assert.equal(activitiesB.length, 0);

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
    }
);
