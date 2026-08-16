import { Server } from "socket.io";

let io;

export function initializeSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${socket.id}`);
      console.log(`Reason: ${reason}`);
    });
  });

  return io;
}

export function getSocketServer() {
  if (!io) {
    throw new Error("Socket.IO server has not been initialized");
  }

  return io;
}