import {
    Link,
    Navigate,
} from "react-router";

import { useAuth } from "../auth/AuthContext.jsx";

export default function WorkspaceRedirect() {
    const { memberships } = useAuth();

    const firstMembership = memberships[0];

    if (firstMembership?.workspace?.slug) {
        return (
            <Navigate
                to={`/app/${firstMembership.workspace.slug}`}
                replace
            />
        );
    }

    return (
        <main className="full-page-state">
            <section className="empty-state">
                <h1>No active workspace</h1>

                <p>
                    Your account does not currently have an active
                    workspace membership.
                </p>

                <Link
                    className="button button-primary"
                    to="/register"
                >
                    Register a workspace
                </Link>
            </section>
        </main>
    );
}