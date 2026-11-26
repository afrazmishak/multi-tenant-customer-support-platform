import test from "node:test";
import assert, { rejects } from "node:assert/strict";
import http from "node:http";

import app from "../../src/app.js";

import {
    initializeSocketServer,
    getSocketServer,
} from "../../src/socket/socket.js";

import {
    emitTicketUpdated,
    emitTicketActivityChanged,
} from "../../src/socket/ticketRealtime.js";

import {
    getWorkspaceRoom,
    getTicketRoom,
} from "../../src/socket/socketRooms.js";

test(
    "Socket.IO broadcasts ticket events to the correct rooms",
    async () => {
        const httpServer = http.createServer(app);
        let io = null;

        try {
            // Use an automatically assigned local port.
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

            io = initializeSocketServer(httpServer);

            assert.equal(
                getSocketServer(),
                io
            );

            // Observe outgoing Socket.IO broadcasts.
            const adapter = io.of("/").adapter;
            const originalBroadcast = adapter.broadcast;

            const broadcasts = [];

            adapter.broadcast = function (packet, options) {
                broadcasts.push({
                    event: packet.data[0],
                    payload: packet.data[1],
                    rooms: [...options.rooms],
                });

                return originalBroadcast.call(
                    this,
                    packet,
                    options
                );
            };

            const workspaceId =
                "507f1f77bcf86cd799439011";

            const ticketId =
                "507f191e810c19729de860ea";

            const ticket = {
                id: ticketId,
                status: "in_progress",
            };

            // Event 1: Workspace-wide ticket update.
            emitTicketUpdated({
                workspaceId,
                ticket,
            });

            // Event 2: Ticket-specific activity update.
            emitTicketActivityChanged({
                workspaceId,
                ticketId,
            });

            assert.equal(
                broadcasts.length,
                2,
                "Exactly two broadcasts are expected"
            );

            // Verify ticket:updated.
            assert.equal(
                broadcasts[0].event,
                "ticket:updated"
            );

            assert.deepEqual(
                broadcasts[0].rooms,
                [getWorkspaceRoom(workspaceId)]
            );

            assert.deepEqual(
                broadcasts[0].payload,
                { ticket }
            );

            // Verify ticket:activity:changed
            assert.equal(
                broadcasts[1].event,
                "ticket:activity:changed"
            );

            assert.deepEqual(
                broadcasts[1].rooms,
                [getTicketRoom(workspaceId, ticketId)]
            );

            assert.deepEqual(
                broadcasts[1].payload,
                { ticketId }
            );

        } finally {
            // Close Socket.IO and its HTTP server.
            if (io) {
                await new Promise((resolve) => {
                    io.close(resolve);
                });
            } else if (httpServer.listening) {
                await new Promise((resolve) => {
                    httpServer.close(resolve);
                });
            }
        }
    }
);