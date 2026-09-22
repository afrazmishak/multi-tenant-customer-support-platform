import { Server } from "socket.io";

import { authenticateSocket } from "./socketAuth.middleware.js";
import { resolveSocketTenant } from "./resolveSocketTenant.middleware.js";
import { getWorkspaceRoom, } from "./socketRooms.js";
import { registerTicketRoomHandlers, } from "./ticketRoom.handlers.js";
import { addUserSocket, removeUserSocket, getOnlineUserIds, } from "./presenceManager.js";

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

    // Register socket presence
    const socketCount = addUserSocket({
      tenantId,
      userId,
      socketId: socket.id,
    });

    const onlineUserIds = getOnlineUserIds(tenantId);

    socket.emit("presence:snapshot",
      {
        userIds: onlineUserIds,
      });

    console.log("[PRESENCE SNAPSHOT]", {
      workspace: workspace.slug,
      userId: String(userId),
      onlineUserIds,
    });

    if (socketCount === 1) {
      console.log("[EMITTING ONLINE]", {
        workspace: workspace.slug,
        userId: String(userId),
      });

      socket.to(workspaceRoom).emit(
        "presence:user:online",
        {
          userId: String(userId),
          online: true,
        }
      );
    }

    console.log("[PRESENCE CONNECT]", {
      workspace: workspace.slug,
      userId: String(userId),
      socketId: socket.id,
      socketCount,
      workspaceRoom,
    });

    console.log(`Socket connected: ${socket.id}`);
    console.log(`Authenticated user: ${userId}`);
    console.log(`Workspace: ${workspace.slug}`);
    console.log(`Role: ${membership.role}`);
    console.log(`Joined room: ${workspaceRoom}`);

    // Presetve existing ticket room handlers
    registerTicketRoomHandlers(socket);

    socket.on("disconnect", (reason) => {
      const remainingSockets = removeUserSocket({
        tenantId,
        userId,
        socketId: socket.id,
      });

      console.log("[PRESENCE DISCONNECT]", {
        workspace: workspace.slug,
        userId: String(userId),
        socketId: socket.id,
        remainingSockets,
      });

      // Last connection for the user
      if (remainingSockets === 0) {
        io.to(workspaceRoom).emit(
          "presence:user:offline",
          {
            userId,
            online: false,
          }
        );
      }

      console.log(
        `Socket disconnected: ${socket.id}`
      );
      console.log(`Reason: ${reason}`);

      console.log(`Remaining user sockets: ${remainingSockets}`);
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