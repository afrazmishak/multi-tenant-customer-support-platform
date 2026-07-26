import {
    Navigate,
    Outlet,
} from "react-router";

import { useAuth } from "../auth/AuthContext.jsx";
import FullPageLoader from "../components/FullPageLoader.jsx";

export default function PublicOnlyRoute() {
    const {
        isAuthenticated,
        isBootstrapping,
    } = useAuth();

    if (isBootstrapping) {
        return (
            <FullPageLoader message="Checking your session..." />
        );
    }

    if (isAuthenticated) {
        return <Navigate to="/app" replace />;
    }

    return <Outlet />;
}