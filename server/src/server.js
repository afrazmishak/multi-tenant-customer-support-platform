import "dotenv/config";

import app from "./app.js";

const port = Number(process.env.PORT) || 5000;

const server = app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);

  server.close(() => {
    process.exit(1);
  });
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});