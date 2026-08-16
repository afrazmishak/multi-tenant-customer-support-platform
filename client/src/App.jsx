import {
  Navigate,
  Route,
  Routes,
} from "react-router";

import { useEffect } from "react";
import { socket } from "./services/socket.js";

import DashboardPage from "./pages/DashboardPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import RegisterWorkspacePage from "./pages/RegisterWorkspacePage.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import PublicOnlyRoute from "./routes/PublicOnlyRoute.jsx";
import WorkspaceRedirect from "./routes/WorkspaceRedirect.jsx";

export default function App() {
  useEffect(() => {

    function handleConnect() {
      console.log("Socket connected:", socket.id);
    }

    function handleDisconnect(reason) {
      console.log("Socket disconnected:", reason);
    }

    //TEMPORARY TEST
    function handleConnectError(error) {
      console.error("Socket connection failed:", error.message);
    }

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError); // TEMPORARY TEST
    socket.on("disconnect", handleDisconnect);

    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.off("disconnect", handleDisconnect);

      socket.disconnect();
    };
  }, []);

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to="/app" replace />}
      />

      <Route element={<PublicOnlyRoute />}>
        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/register"
          element={<RegisterWorkspacePage />}
        />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route
          path="/app"
          element={<WorkspaceRedirect />}
        />

        <Route
          path="/app/:workspaceSlug"
          element={<DashboardPage />}
        />
      </Route>

      <Route
        path="*"
        element={<NotFoundPage />}
      />
    </Routes>
  );
}