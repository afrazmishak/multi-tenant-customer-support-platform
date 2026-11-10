import { useEffect, useState } from "react";

import {
    socket,
} from "../socket/socket.js";

import {
    getWorkspaceTicketsRequest,
} from "../api/ticketApi.js";

import {
    useWorkspacePresence,
} from "../context/WorkspacePresenceContext.js";

import TicketDetailsDrawer from "./TicketDetailsDrawer.jsx";

import "./TicketInboxPreview.css";

function formatLabel(value) {
    if (!value) {
        return "Unknown";
    }

    return String(value)
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) =>
            character.toUpperCase()
        );
}

function formatDate(value) {
    if (!value) {
        return "Date unavailable";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Date unavailable";
    }

    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
    }).format(date);
}

function getAssigneeId(assignedTo) {
    if (!assignedTo) {
        return null;
    }

    if (typeof assignedTo === "string") {
        return assignedTo;
    }

    return String(
        assignedTo.id ?? assignedTo._id ?? ""
    ) || null;
}

function getTicketAge(
    createdAt,
    now
) {
    if (!createdAt) {
        return {
            label: "Age unavailable",
            level: "unknown"
        };
    }

    const createdTime =
        new Date(createdAt).getTime();

    if (
        Number.isNaN(createdTime)
    ) {
        return {
            label: "Age unavailable",
            level: "unknown"
        };
    }

    const ageMs =
        Math.max(
            0,
            now - createdTime
        );

    const minutes =
        Math.floor(
            ageMs / (1000 * 60)
        );

    const hours =
        Math.floor(
            ageMs /
            (1000 * 60 * 60)
        );

    const days =
        Math.floor(
            ageMs /
            (1000 * 60 * 60 * 24)
        );

    let label;

    if (minutes < 60) {
        label =
            `${Math.max(minutes, 1)} min`;
    } else if (hours < 24) {
        label =
            `${hours} ${hours === 1
                ? "hour"
                : "hours"}`;
    } else {
        label =
            `${days} ${days === 1
                ? "day"
                : "days"}`;
    }

    let level = "fresh"

    if (hours >= 72) {
        level = "old";
    } else if (hours >= 24) {
        level = "aging"
    }

    return {
        label,
        level,
    };
}

function getTicketStaleness(
    ticket,
    now
) {
    if (
        ticket.status === "resolved" ||
        ticket.status === "closed"
    ) {
        return null;
    }

    const activityValue =
        ticket.lastActivityAt ??
        ticket.updatedAt ??
        ticket.createdAt;

    if (!activityValue) {
        return null;
    }

    const activityTime =
        new Date(
            activityValue
        ).getTime();

    if (
        Number.isNaN(activityTime)
    ) {
        return null;
    }

    const elapsedMs =
        Math.max(
            0,
            now - activityTime
        );

    const hours =
        Math.floor(
            elapsedMs /
            (1000 * 60 * 60)
        );

    if (hours < 24) {
        return {
            level: "fresh",
            label: null,
        };
    }

    const days =
        Math.floor(
            hours / 24
        );

    if (hours >= 72) {
        return {
            level: "very-stale",
            label:
                `${days} ${days === 1
                    ? "day"
                    : "days"}`,
        };
    }

    return {
        level: "stale",
        label:
            `${days} ${days === 1
                ? "day"
                : "days"}`,
    };
}

function isAwaitingFirstResponse(
    ticket
) {
    if (!ticket) {
        return false;
    }

    const isActive =
        ticket.status !== "resolved" &&
        ticket.status !== "closed";

    return (
        isActive &&
        !ticket.firstResponseAt
    );
}

export default function TicketInboxPreview({
    workspaceSlug,
}) {
    const {
        members,
        directoryLoading,
    } = useWorkspacePresence();

    const [ticketState, setTicketState] = useState({
        requestKey: null,
        tickets: [],
        pagination: null,
        error: null,
    });

    const [
        selectedTicketId,
        setSelectedTicketId,
    ] = useState(null);

    const [queueFilters, setQueueFilters] =
        useState({
            search: "",
            status: "all",
            priority: "all",
            sort: "updated_desc",
        });

    const [queueView, setQueueView] =
        useState("active");

    const [page, setPage] = useState(1);

    const [refreshVersion, setRefreshVersion] = useState(0);

    function changeQueueView(nextView) {
        setQueueView(nextView);
        setPage(1);
    }

    const [now, setNow] = useState(() => Date.now());

    const requestKey = JSON.stringify({
        workspaceSlug,
        view: queueView,
        page,
        search: queueFilters.search,
        status: queueFilters.status,
        priority: queueFilters.priority,
        sort: queueFilters.sort,
        refreshVersion,
    });

    function openTicket(ticketId) {
        setSelectedTicketId(ticketId);
    }

    function closeTicket() {
        setSelectedTicketId(null);
    }

    useEffect(() => {
        // Load tickets through HTTP
        if (!workspaceSlug) {
            return;
        }

        const controller = new AbortController();
        let cancelled = false;

        async function loadTickets() {
            try {
                const result = await getWorkspaceTicketsRequest(
                    workspaceSlug,
                    {
                        signal: controller.signal,
                        view: queueView,
                        page,
                        limit: 25,
                        search: queueFilters.search,
                        status: queueFilters.status,
                        priority: queueFilters.priority,
                        sort: queueFilters.sort,
                    }
                );

                const tickets = result?.data?.tickets;
                const pagination = result?.data?.pagination;

                if (!Array.isArray(tickets) ||
                    !pagination) {
                    throw new Error(
                        "Unexpected ticket queue response"
                    );
                }

                if (!cancelled) {
                    setTicketState({
                        requestKey,
                        tickets,
                        pagination,
                        error: null,
                    });
                }
            } catch (error) {
                if (
                    cancelled ||
                    error.name === "AbortError"
                ) {
                    return;
                }

                setTicketState({
                    requestKey,
                    tickets: [],
                    pagination: null,
                    error: error.message,
                });
            }
        }

        loadTickets();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [
        workspaceSlug,
        queueView,
        page,
        queueFilters.search,
        queueFilters.status,
        queueFilters.priority,
        queueFilters.sort,
        refreshVersion,
        requestKey,
    ]);

    useEffect(() => {
        if (!workspaceSlug) {
            return;
        }

        let refreshTimeout = null;

        function scheduleQueueRefresh() {
            if (refreshTimeout !== null) {
                clearTimeout(refreshTimeout);
            }

            refreshTimeout = setTimeout(() => {
                refreshTimeout = null;

                setRefreshVersion(
                    (previous) => previous + 1
                );
            }, 250);
        }

        const events = [
            "ticket:created",
            "ticket:updated",
            "ticket:message:created",
            "ticket:activity:changed",
        ];

        events.forEach((event) => {
            socket.on(event, scheduleQueueRefresh);
        });

        return () => {
            if (refreshTimeout !== null) {
                clearTimeout(refreshTimeout);
            }

            events.forEach((event) => {
                socket.off(event, scheduleQueueRefresh);
            });
        };
    }, [workspaceSlug]);

    useEffect(() => {
        const intervalId =
            window.setInterval(() => {
                setNow(Date.now());
            }, 60_000);

        return () => {
            window.clearInterval(
                intervalId
            );
        };
    }, []);

    const isLoading =
        ticketState.requestKey !== requestKey;

    const tickets = isLoading
        ? []
        : ticketState.tickets;

    const pagination = isLoading
        ? null
        : ticketState.pagination;

    function getQueueCount(view) {
        if (queueView !== view) {
            return "—";
        }

        return pagination?.totalTickets ?? "—";
    }

    const visibleTickets = tickets;

    const error = isLoading
        ? null
        : ticketState.error;

    const memberMap = new Map(
        members.map((member) => [
            String(member.user.id),
            member,
        ])
    );

    return (
        <section className="dashboard-panel ticket-inbox">
            <header className="ticket-inbox-header">
                <div>
                    <p className="eyebrow">
                        Support Operations
                    </p>

                    <h2>Ticket Inbox</h2>

                    <p className="ticket-inbox-description">
                        Tickets belonging to the current workspace.
                    </p>
                </div>

                {!isLoading && !error && (
                    <span className="ticket-count">
                        {tickets.length} of {pagination?.totalTickets ?? 0} displayed
                    </span>
                )}
            </header>

            <div className="ticket-queue-views">
                <button
                    type="button"
                    className={
                        queueView === "active"
                            ? "ticket-queue-view active"
                            : "ticket-queue-view"
                    }
                    onClick={() => changeQueueView("active")}
                >
                    <span>Active</span>
                    <span className="ticket-queue-count">
                        {getQueueCount("active")}
                    </span>
                </button>

                <button
                    type="button"
                    className={
                        queueView ===
                            "awaiting_response"
                            ? "ticket-queue-view active"
                            : "ticket-queue-view"
                    }
                    onClick={() => changeQueueView("awaiting_response")}
                >
                    <span>
                        Awaiting Response
                    </span>

                    <span className="ticket-queue-count">
                        {getQueueCount("awaiting_response")}
                    </span>
                </button>

                <button type="button"
                    className={
                        queueView === "stale"
                            ? "ticket-queue-view active"
                            : "ticket-queue-view"
                    }
                    onClick={() => changeQueueView("stale")}>
                    <span>Stale</span>

                    <span className="ticket-queue-count">
                        {getQueueCount("stale")}
                    </span>
                </button>

                <button
                    type="button"
                    className={
                        queueView === "all"
                            ? "ticket-queue-view active"
                            : "ticket-queue-view"
                    }
                    onClick={() => changeQueueView("all")}
                >
                    <span>All Tickets</span>

                    <span className="ticket-queue-count">
                        {getQueueCount("all")}
                    </span>
                </button>

                <button
                    type="button"
                    className={
                        queueView === "mine"
                            ? "ticket-queue-view active"
                            : "ticket-queue-view"
                    }
                    onClick={() => {
                        setQueueView("mine")
                        setPage(1)
                    }}
                >

                    <span>My Tickets</span>

                    <span className="ticket-queue-count">
                        {getQueueCount("mine")}
                    </span>
                </button>

                <button
                    type="button"
                    className={
                        queueView === "unassigned"
                            ? "ticket-queue-view active"
                            : "ticket-queue-view"
                    }
                    onClick={() => changeQueueView("unassigned")}
                >
                    <span>Unassigned</span>
                    <span className="ticket-queue-count">
                        {getQueueCount("unassigned")}
                    </span>
                </button>
            </div>

            <div className="ticket-inbox-controls">
                <input
                    type="search"
                    placeholder="Search tickets..."
                    value={queueFilters.search}
                    onChange={(event) => {
                        setQueueFilters(
                            (previous) => ({
                                ...previous,
                                search:
                                    event.target.value,
                            })
                        );
                        setPage(1);
                    }}
                />

                <select
                    value={queueFilters.status}
                    onChange={(event) => {
                        setQueueFilters(
                            (previous) => ({
                                ...previous,
                                status:
                                    event.target.value,
                            })
                        );
                    }}
                >
                    <option value="all">
                        All statuses
                    </option>

                    <option value="open">
                        Open
                    </option>

                    <option value="in_progress">
                        In Progress
                    </option>

                    <option value="waiting_on_customer">
                        Waiting on Customer
                    </option>

                    <option value="resolved">
                        Resolved
                    </option>

                    <option value="closed">
                        Closed
                    </option>
                </select>

                <select
                    value={queueFilters.priority}
                    onChange={(event) => {
                        setQueueFilters(
                            (previous) => ({
                                ...previous,
                                priority:
                                    event.target.value,
                            })
                        );
                    }}
                >
                    <option value="all">
                        All priorities
                    </option>

                    <option value="low">
                        Low
                    </option>

                    <option value="normal">
                        Normal
                    </option>

                    <option value="high">
                        High
                    </option>

                    <option value="urgent">
                        Urgent
                    </option>
                </select>

                <select
                    value={queueFilters.sort}
                    onChange={(event) => {
                        setQueueFilters(
                            (previous) => ({
                                ...previous,
                                sort:
                                    event.target.value,
                            })
                        );
                    }}
                >
                    <option value="updated_desc">
                        Recently updated
                    </option>

                    <option value="updated_asc">
                        Oldest updated
                    </option>

                    <option value="priority_desc">
                        Priority - Urgent first
                    </option>

                    <option value="priority_asc">
                        Priority - Low first
                    </option>

                    <option value="created_asc">
                        Oldest tickets first
                    </option>

                    <option value="created_desc">
                        Newest tickets first
                    </option>
                </select>

                <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => {
                        setQueueFilters({
                            search: "",
                            status: "all",
                            priority: "all",
                            sort: "updated_desc",
                        });
                    }}
                >
                    Clear filters
                </button>
            </div>

            {isLoading ? (
                <p>Loading tickets...</p>
            ) : error ? (
                <p role="alert">
                    Unable to load tickets: {error}
                </p>
            ) : tickets.length === 0 ? (
                <div className="ticket-empty-state">
                    <h3>No tickets found</h3>
                </div>
            ) : visibleTickets.length === 0 ? (
                <div className="ticket-empty-state">
                    <h3>No matching tickets</h3>
                    <p>Try changing your search or filters</p>
                </div>
            ) : (
                <ul className="ticket-list">
                    {visibleTickets.map((ticket) => {
                        const ticketId =
                            String(ticket.id ?? ticket._id);

                        const isSelected =
                            selectedTicketId === ticketId;

                        const assignedId =
                            getAssigneeId(ticket.assignedTo);

                        const assignee = assignedId
                            ? memberMap.get(assignedId)
                            : null;

                        const reference =
                            ticket.reference ??
                            `#${ticket.ticketNumber}`;

                        const ticketAge =
                            getTicketAge(
                                ticket.createdAt,
                                now
                            );

                        const ticketStaleness =
                            getTicketStaleness(
                                ticket,
                                now
                            );

                        const awaitingFirstResponse =
                            isAwaitingFirstResponse(
                                ticket
                            );

                        return (
                            <li className="ticket-item"
                                data-priority={ticket.priority}
                                key={ticket.id ?? ticket._id}
                            >

                                <div className="ticket-item-top">
                                    <span className="ticket-reference">
                                        {reference}
                                    </span>

                                    <span
                                        className="ticket-status"
                                        data-status={ticket.status}
                                    >
                                        {formatLabel(ticket.status)}
                                    </span>
                                </div>

                                <h3 className="ticket-subject">
                                    {ticket.subject}
                                </h3>

                                <div className="ticket-item-meta">
                                    <span
                                        className="ticket-priority"
                                        data-priority={ticket.priority}
                                    >
                                        {ticket.priority === "urgent" && (
                                            <span
                                                className="ticket-priority-alert"
                                                aria-hidden="true">
                                                !
                                            </span>
                                        )}
                                        Priority: {" "}
                                        {formatLabel(ticket.priority)}
                                    </span>

                                    <span>
                                        Updated:{" "}
                                        {formatDate(ticket.updatedAt)}
                                    </span>

                                    <span className="ticket-age"
                                        data-age-level={
                                            ticketAge.level
                                        }
                                    >
                                        Age: {ticketAge.label}
                                    </span>

                                    {ticketStaleness?.label && (
                                        <span
                                            className="ticket-stale"
                                            data-stale-level={
                                                ticketStaleness.level
                                            }
                                        >
                                            No activity:{" "}
                                            {ticketStaleness.label}
                                        </span>
                                    )}

                                    {awaitingFirstResponse && (
                                        <span
                                            className=
                                            "ticket-first-response"
                                        >
                                            Awaiting first response
                                        </span>
                                    )}
                                </div>

                                <div className="ticket-assignment">
                                    <span className="ticket-assignment-label">
                                        Assigned to
                                    </span>

                                    <strong>
                                        {!assignedId
                                            ? "Unassigned"
                                            : assignee
                                                ? assignee.user.name
                                                : directoryLoading
                                                    ? "Loading agent..."
                                                    : "Assigned member unavailable"
                                        }
                                    </strong>

                                    {assignee && (
                                        <span
                                            className={
                                                assignee.isOnline
                                                    ? "ticket-agent-online"
                                                    : "ticket-agent-offline"
                                            }
                                        >
                                            {assignee.isOnline
                                                ? "Online"
                                                : "Offline"
                                            }
                                        </span>
                                    )}
                                </div>


                                <button
                                    type="button"
                                    className="button button-secondary ticket-view-button"
                                    onClick={() => openTicket(ticketId)}
                                    disabled={isSelected}
                                >
                                    {isSelected ? "Details open" : "View details"}
                                </button>

                                {isSelected && (
                                    <TicketDetailsDrawer
                                        key={`${workspaceSlug}:${ticketId}`}
                                        workspaceSlug={workspaceSlug}
                                        ticketId={ticketId}
                                        realtimeTicket={ticket}
                                        onClose={closeTicket}
                                    />
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {!isLoading && !error && pagination && (
                <footer className="ticket-queue-pagination">
                    <p>
                        Total matching tickets:{" "}
                        {pagination.totalTickets}
                    </p>

                    <div className="ticket-pagination-controls">
                        <button
                            type="button"
                            className="button button-secondary"
                            disabled={!pagination.hasPreviousPage}
                            onClick={() => {
                                setPage((current) =>
                                    Math.max(1, current - 1)
                                );
                            }}
                        >
                            Previous
                        </button>

                        <span>
                            Page {pagination.page} of {" "}
                            {Math.max(1, pagination.totalPages)}
                        </span>

                        <button
                            type="button"
                            className="button button-secondary"
                            disabled={!pagination.hasNextPage}
                            onClick={() => {
                                setPage((current) => current + 1);
                            }}
                        >
                            Next
                        </button>
                    </div>
                </footer>
            )}
        </section>
    );
}
