import { Link } from "react-router";

export default function NotFoundPage() {
    return (
        <main className="full-page-state">
            <section className="empty-state">
                <span className="status-badge">
                    404
                </span>

                <h1>Page not found</h1>

                <p>
                    The requested page does not exist.
                </p>

                <Link
                    className="button button-primary"
                    to="/app"
                >
                    Return to dashboard
                </Link>
            </section>
        </main>
    );
}