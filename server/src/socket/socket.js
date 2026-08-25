import { Server } from "socket.io";

import { authenticateSocket } from "./socketAuth.middleware.js";
import { resolveSocketTenant } from "./resolveSocketTenant.middleware.js";

import { getWorkspaceRoom, } from "./socketRooms.js";

let io;

export function initializeSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  io.use(authenticateSocket);
  io.use(resolveSocketTenant);

  io.on("connection", (socket) => {
    const {
      tenantId,
      workspace,
      membership,
      userId,
    } = socket.data.tenantContext;

    const workspaceRoom =
      getWorkspaceRoom(tenantId);

    socket.join(workspaceRoom);

    console.log(`Socket connected: ${socket.id}`);
    console.log(`Authenticated user: ${socket.data.auth.userId}`);
    console.log(`Workspace: ${socket.data.tenantContext.workspace.slug}`);
    console.log(`Role: ${socket.data.tenantContext.membership.role}`);
    console.log(`Joined room: ${workspaceRoom}`);

    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${socket.id}`);
      console.log(`Reason: ${reason}`);
    });
  });

  return io;
}

export function getSocketServer() {
  if (!io) {
    throw new Error(
      "Socket.IO server has not been initialized"
    );
  }

  return io;
}