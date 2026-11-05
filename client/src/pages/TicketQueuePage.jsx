import { useState } from "react";
import { useTickets } from "../hooks/useTickets.js";
import "./TicketQueuePage.css";

const QUEUE_VIEWS = [
    { label: "Active", value: "active" },
    { label: "Awaiting Response", value: "awaiting_response" },
    { label: "Mine", value: "mine" },
    { label: "Unassigned", value: "unassigned" },
    { label: "Stale", value: "stale" },
    { label: "All", value: "all" },
];

const STATUS_LABELS = {
    open: "Open",
    in_progress: "In Progress",
    waiting_on_customer: "Waiting on Customer",
    resolved: "Resolved",
    closed: "Closed",
};

function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleString();
}

export default function TicketQueuePage({
    workspaceSlug,
}) {
    const [view, setView] = useState("active");
    const [page, setPage] = useState(1);

    const {
        tickets,
        pagination,
        loading,
        error,
    } = useTickets({
        workspaceSlug,
        view,
        page,
        limit: 25,
    });

    function chnageView(nextView) {
        setView(nextView);
        setPage(1);
    }

    return (
        <main className="ticket-queue">
            <header className="ticket-queue__header">
                <div>
                    <h1>Ticket Queue</h1>
                    <p>Manage customer support requests across your workspace.</p>
                </div>
            </header>

            <nav className="ticket-queue__tabs"
                aria-label="Ticket queue views"
            >
                {QUEUE_VIEWS.map((item) => (
                    <button
                        key={item.value}
                        type="button"
                        className={
                            view === item.value
                                ? "ticket-tab ticket-tab--active"
                                : "ticket-tab"
                        }
                        aria-current={
                            view === item.value
                                ? "page"
                                : undefined
                        }
                        onClick={() =>
                            chnageView(item.value)
                        }
                    >
                        {item.label}
                    </button>
                ))}
            </nav>

            {!workspaceSlug && (
                <p role="alert" className="ticket-error">
                    Select a workspace to view tickets.
                </p>
            )}

            {workspaceSlug && (
                <section className="ticket-queue__content">
                    {loading && (
                        <p role="status" className="ticket-state">
                            Loading tickets...
                        </p>
                    )}

                    {!loading && error && (
                        <p role="alert"
                            className="ticket-error">
                            {error}
                        </p>
                    )}

                    {!loading &&
                        !error &&
                        tickets.length === 0 && (
                            <p className="ticket-stale">
                                No tickets found in this queue.
                            </p>
                        )}

                    {!loading &&
                        !error &&
                        tickets.length > 0 && (
                            <div className="ticket-table-wrapper">
                                <table className="ticket-table">
                                    <thead>
                                        <tr>
                                            <th>Reference</th>
                                            <th>Subject</th>
                                            <th>Priority</th>
                                            <th>Status</th>
                                            <th>Last Activity</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {tickets.map((ticket) => (
                                            <tr key={ticket.id}>
                                                <td>{ticket.reference ??
                                                    `#${ticket.ticketNumber}`}
                                                </td>

                                                <td>
                                                    {ticket.subject}
                                                </td>

                                                <td>
                                                    <span
                                                        className={
                                                            `ticket-priority ticket-priority--${ticket.priority}`
                                                        }
                                                    >
                                                        {ticket.priority}
                                                    </span>
                                                </td>

                                                <td>
                                                    {STATUS_LABELS[
                                                        ticket.status
                                                    ] ?? ticket.status}
                                                </td>

                                                <td>
                                                    {formatDate(
                                                        ticket.lastActivity ??
                                                        ticket.updatedAt
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                    {!loading && !error && pagination && (
                        <footer className="ticket-queue__footer">
                            <p>
                                Total tickets:{" "}
                                {pagination.totalTickets}
                            </p>

                            <div className="ticket-pagination">
                                <button
                                    type="button"
                                    disabled={
                                        !pagination.hasPreviousPage
                                    }
                                    onClick={() =>
                                        setPage((current) =>
                                            Math.max(
                                                1,
                                                current - 1
                                            )
                                        )
                                    }
                                >
                                    Previous
                                </button>

                                <span>
                                    Page {pagination.page} of {" "}
                                    {Math.max(
                                        pagination.totalPages,
                                        1
                                    )}
                                </span>

                                <button
                                    type="button"
                                    disabled={
                                        !pagination.hasNextPage
                                    }
                                    onClick={() =>
                                        setPage((current) =>
                                            current + 1
                                        )
                                    }
                                >
                                    Next
                                </button>
                            </div>
                        </footer>
                    )}
                </section>
            )}
        </main>
    );
}