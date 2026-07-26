import {
    useEffect,
    useState,
} from "react";
import {
    NavLink,
    useNavigate,
    useParams,
} from "react-router";

import { getWorkspaceContextRequest } from "../api/workspaceApi.js";
import { useAuth } from "../auth/AuthContext.jsx";
import FullPageLoader from "../components/FullPageLoader.jsx";

export default function DashboardPage() {
    const { workspaceSlug } = useParams();
    const navigate = useNavigate();

    const {
        user,
        memberships,
        logout,
    } = useAuth();

    const [tenantContext, setTenantContext] =
        useState(null);

    const [errorMessage, setErrorMessage] =
        useState("");

    const [isLoading, setIsLoading] = useState(true);
    const [isLoggingOut, setIsLoggingOut] =
        useState(false);

    useEffect(() => {
        let cancelled = false;

        async function loadTenantContext() {
            setIsLoading(true);
            setErrorMessage("");
            setTenantContext(null);

            try {
                const response =
                    await getWorkspaceContextRequest(
                        workspaceSlug
                    );

                if (!cancelled) {
                    setTenantContext(response.data);
                }
            } catch (error) {
                if (!cancelled) {
                    setErrorMessage(error.message);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        loadTenantContext();

        return () => {
            cancelled = true;
        };
    }, [workspaceSlug]);

    async function handleLogout() {
        setIsLoggingOut(true);

        try {
            await logout();

            navigate("/login", {
                replace: true,
            });
        } finally {
            setIsLoggingOut(false);
        }
    }

    if (isLoading) {
        return (
            <FullPageLoader message="Loading workspace..." />
        );
    }

    if (errorMessage) {
        return (
            <main className="full-page-state">
                <section className="empty-state">
                    <span className="status-badge status-error">
                        Workspace unavailable
                    </span>

                    <h1>Unable to open this workspace</h1>

                    <p>{errorMessage}</p>

                    <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => navigate("/app")}
                    >
                        Return to your workspace
                    </button>
                </section>
            </main>
        );
    }

    const { workspace, membership } = tenantContext;

    return (
        <div className="app-shell">
            <aside className="sidebar">
                <div className="brand-block sidebar-brand">
                    <span className="brand-mark">A</span>

                    <div>
                        <strong>Alynt Support</strong>
                        <p>Customer support platform</p>
                    </div>
                </div>

                <nav className="workspace-navigation">
                    <p className="navigation-label">
                        Workspaces
                    </p>

                    {memberships.map((item) => (
                        <NavLink
                            key={item.id}
                            to={`/app/${item.workspace.slug}`}
                            className={({ isActive }) =>
                                isActive
                                    ? "workspace-link active"
                                    : "workspace-link"
                            }
                        >
                            <span>
                                {item.workspace.name}
                            </span>

                            <small>{item.role}</small>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-user">
                    <div>
                        <strong>{user.name}</strong>
                        <p>{user.email}</p>
                    </div>

                    <button
                        className="button button-secondary button-full"
                        type="button"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                    >
                        {isLoggingOut
                            ? "Logging out..."
                            : "Log out"}
                    </button>
                </div>
            </aside>

            <main className="dashboard">
                <header className="dashboard-header">
                    <div>
                        <p className="eyebrow">
                            Workspace dashboard
                        </p>

                        <h1>{workspace.name}</h1>

                        <p>
                            Welcome back, {user.name}.
                        </p>
                    </div>

                    <span className="role-badge">
                        {membership.role}
                    </span>
                </header>

                <section className="dashboard-grid">
                    <article className="dashboard-card">
                        <span className="card-label">
                            Workspace URL
                        </span>

                        <strong>{workspace.slug}</strong>
                    </article>

                    <article className="dashboard-card">
                        <span className="card-label">
                            Membership
                        </span>

                        <strong>{membership.status}</strong>
                    </article>

                    <article className="dashboard-card">
                        <span className="card-label">
                            Role
                        </span>

                        <strong>{membership.role}</strong>
                    </article>

                    <article className="dashboard-card">
                        <span className="card-label">
                            Platform status
                        </span>

                        <strong>Foundation active</strong>
                    </article>
                </section>

                <section className="dashboard-panel">
                    <h2>Phase 1 foundation</h2>

                    <p>
                        Authentication, session restoration, tenant
                        isolation, and workspace authorization are active.
                    </p>
                </section>
            </main>
        </div>
    );
}