import {
  Navigate,
  Route,
  Routes,
} from "react-router";

import DashboardPage from "./pages/DashboardPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import RegisterWorkspacePage from "./pages/RegisterWorkspacePage.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import PublicOnlyRoute from "./routes/PublicOnlyRoute.jsx";
import WorkspaceRedirect from "./routes/WorkspaceRedirect.jsx";
import WorkspaceSocketConnection from "./socket/WorkspaceSocketConnection.jsx"

export default function App() {
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

        <Route element={<WorkspaceSocketConnection />}>
          <Route
            path="/app/:workspaceSlug"
            element={<DashboardPage />}
          />
        </Route>
      </Route>

      <Route
        path="*"
        element={<NotFoundPage />}
      />
    </Routes>
  );
}