import "dotenv/config";
import app from "./app.js";
import {
  connectDatabase,
  disconnectDatabase,
} from "./config/database.js"
import { initializeModels } from "./models/index.js";

const port = Number(process.env.PORT) || 5000;

let server;
let isShuttingDown = false;

async function startServer() {
  await connectDatabase();
  await initializeModels();

  server = app.listen(port, () => {
    console.log(`API server running at http://localhost:${port}`);
    console.log(
      `Environment: ${process.env.NODE_ENV || "development"}`
    );
  });
}

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(`${signal} received. Shutting down gracefully...`);

  if (server) {
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });

    return;
  }

  await disconnectDatabase()
  process.exit(0)
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
})

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

process.on("unhandledRejection", async (error) => {
  console.error("Unhandled promise rejection:", error);

  await shutdown("UNHANDLED_REJECTION");
});

process.on("uncaughtException", async (error) => {
  console.error("Uncaught exception:", error);

  await shutdown("UNCAUGHT_EXCEPTION");
});

startServer().catch((error) => {
  console.error("Failed ti start the server:", error.message);
  process.exit(1);
})