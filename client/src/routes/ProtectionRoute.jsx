import {
    Navigate,
    Outlet,
    useLocation,
} from "react-router";

import { useAuth } from "../auth/AuthContext.jsx"
import FullPageLoader from "../components/FullPageLoader.jsx"

export default function ProtectedRoute() {
    const location = useLocation();

    const {
        isAuthenticated,
        isBootstrapping,
    } = useAuth();

    if (isBootstrapping) {
        return (
            <FullPageLoader message="Restoring your session..." />
        );
    }

    if (!isAuthenticated) {
        return (
            <Navigate
                to="/login"
                replace
                state={{
                    from: `${location.pathname}${location.search}`,
                }}
            />
        );
    }

    return <Outlet />;
}