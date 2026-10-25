import { useEffect, useMemo, useState } from "react";

import {
    socket,
} from "../socket/socket.js";

import {
    getWorkspaceContextRequest,
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

const PRIORITY_RANK =
    Object.freeze({
        low: 1,
        normal: 2,
        high: 3,
        urgent: 4,
    });

export default function TicketInboxPreview({
    workspaceSlug,
}) {
    const {
        members,
        directoryLoading,
    } = useWorkspacePresence();

    const [ticketState, setTicketState] = useState({
        workspaceSlug: null,
        tickets: [],
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

    const [currentUserId, setCurrentUserId,] = useState(null);

    const [now, setNow] = useState(() => Date.now());

    function openTicket(ticketId) {
        setSelectedTicketId(ticketId);
    }

    function closeTicket() {
        setSelectedTicketId(null);
    }

    useEffect(() => {
        // load tickets through HTTP
        if (!workspaceSlug) {
            return;
        }

        const controller = new AbortController();
        let cancelled = false;

        async function loadTickets() {
            try {
                const result =
                    await getWorkspaceTicketsRequest(
                        workspaceSlug,
                        {
                            signal: controller.signal,
                        }
                    );

                const tickets = result?.data?.tickets;

                if (!Array.isArray(tickets)) {
                    throw new Error(
                        "Unexpected ticket API response: " +
                        "data.tickets must be an array"
                    );
                }

                if (!cancelled) {
                    setTicketState({
                        workspaceSlug,
                        tickets,
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
                    workspaceSlug,
                    tickets: [],
                    error: error.message,
                });
            }
        }

        loadTickets();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [workspaceSlug]);

    useEffect(() => {
        if (!workspaceSlug) {
            return;
        }

        function handleTicketCreated(payload) {
            const createdTicket =
                payload?.ticket;

            if (!createdTicket) {
                return;
            }

            const createdTicketId =
                String(
                    createdTicket.id ??
                    createdTicket._id ??
                    ""
                );

            if (!createdTicketId) {
                return;
            }

            setTicketState((previous) => {
                if (
                    previous.workspaceSlug !==
                    workspaceSlug
                ) {
                    return previous;
                }

                const alreadyExists =
                    previous.tickets.some(
                        (ticket) =>
                            String(
                                ticket.id ??
                                ticket._id ??
                                ""
                            ) === createdTicketId
                    );

                if (alreadyExists) {
                    return previous;
                }

                return {
                    ...previous,

                    tickets: [
                        createdTicket,
                        ...previous.tickets,
                    ],
                };
            });
        }

        function handleTicketUpdated(payload) {
            const updatedTicket =
                payload?.ticket;

            if (!updatedTicket) {
                return;
            }

            const updatedTicketId =
                String(
                    updatedTicket.id ??
                    updatedTicket._id ??
                    ""
                );

            if (!updatedTicketId) {
                return;
            }

            setTicketState((previous) => {
                if (
                    previous.workspaceSlug !==
                    workspaceSlug
                ) {
                    return previous;
                }

                return {
                    ...previous,

                    tickets:
                        previous.tickets.map(
                            (ticket) => {
                                const ticketId =
                                    String(
                                        ticket.id ??
                                        ticket._id ??
                                        ""
                                    );

                                return ticketId ===
                                    updatedTicketId
                                    ? updatedTicket
                                    : ticket;
                            }
                        ),
                };
            });
        }

        socket.on(
            "ticket:updated",
            handleTicketUpdated
        );

        socket.on(
            "ticket:created",
            handleTicketCreated
        );

        return () => {
            socket.off(
                "ticket:updated",
                handleTicketUpdated
            );

            socket.off(
                "ticket:created",
                handleTicketCreated
            );
        };
    }, [workspaceSlug]);

    useEffect(() => {
        if (!workspaceSlug) {
            return;
        }

        const controller =
            new AbortController();

        let cancelled = false;

        async function loadWorkspaceContext() {
            try {
                const result =
                    await getWorkspaceContextRequest(
                        workspaceSlug,
                        {
                            signal:
                                controller.signal,
                        }
                    );

                const userId =
                    result?.data
                        ?.currentUserId;

                if (!cancelled) {
                    setCurrentUserId(
                        userId
                            ? String(userId)
                            : null
                    );
                }
            } catch (error) {
                if (
                    cancelled ||
                    error.name === "AbortError"
                ) {
                    return;
                }

                console.error(
                    "Unable to load workspace context",
                    error
                );

                setCurrentUserId(null);
            }
        }

        loadWorkspaceContext();

        return () => {
            cancelled = true;
            controller.abort();
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
        ticketState.workspaceSlug !==
        workspaceSlug;

    const tickets = useMemo(
        () =>
            isLoading
                ? []
                : ticketState.tickets,
        [
            isLoading,
            ticketState.tickets
        ]
    );

    const queueCounts = useMemo(() => {
        let activeTickets = 0;
        let myTickets = 0;
        let unassignedTickets = 0;

        for (const ticket of tickets) {
            const assignedTo =
                getAssigneeId(
                    ticket.assignedTo
                );

            const isActive =
                ticket.status !== "resolved" &&
                ticket.status !== "closed";

            if (isActive) {
                activeTickets += 1;
            }

            if (!assignedTo) {
                unassignedTickets += 1;
            }

            if (
                currentUserId &&
                assignedTo ===
                String(currentUserId)
            ) {
                myTickets += 1;
            }
        }

        return {
            active: activeTickets,
            all: tickets.length,
            mine: myTickets,
            unassigned: unassignedTickets,
        };
    }, [
        tickets,
        currentUserId,
    ]);

    const visibleTickets = useMemo(() => {
        const search =
            queueFilters.search
                .trim()
                .toLowerCase();

        const filteredTickets =
            tickets.filter((ticket) => {
                const assignedTo =
                    getAssigneeId(
                        ticket.assignedTo
                    );

                if (
                    queueView === "active" &&
                    (
                        ticket.status === "resolved" ||
                        ticket.status === "closed"
                    )
                ) {
                    return false;
                }

                if (
                    queueView === "mine" &&
                    (
                        !currentUserId ||
                        assignedTo !==
                        String(currentUserId)
                    )
                ) {
                    return false;
                }

                if (
                    queueView === "unassigned" &&
                    assignedTo
                ) {
                    return false
                }

                if (
                    queueFilters.status !== "all" &&
                    ticket.status !==
                    queueFilters.status
                ) {
                    return false;
                }

                if (
                    queueFilters.priority !== "all" &&
                    ticket.priority !==
                    queueFilters.priority
                ) {
                    return false;
                }

                if (!search) {
                    return true;
                }

                const reference =
                    String(
                        ticket.reference ??
                        ticket.ticketNumber ??
                        ""
                    ).toLowerCase();

                const subject =
                    String(
                        ticket.subject ?? ""
                    ).toLowerCase();

                const category =
                    String(
                        ticket.category ?? ""
                    ).toLowerCase();

                const tags =
                    Array.isArray(ticket.tags)
                        ? ticket.tags.join(" ")
                        : "";

                const customerName =
                    typeof ticket.customer ===
                        "object"
                        ? String(
                            ticket.customer?.name ??
                            ""
                        ).toLowerCase()
                        : "";

                return [
                    reference,
                    subject,
                    category,
                    tags.toLowerCase(),
                    customerName,
                ].some((value) =>
                    value.includes(search)
                );
            });

        return [...filteredTickets].sort(
            (ticketA, ticketB) => {
                const updatedA =
                    new Date(
                        ticketA.updatedAt ?? 0
                    ).getTime();

                const updatedB =
                    new Date(
                        ticketB.updatedAt ?? 0
                    ).getTime();

                const createdA =
                    new Date(
                        ticketA.createdAt ?? 0
                    ).getTime();

                const createdB =
                    new Date(
                        ticketB.createdAt ?? 0
                    ).getTime();

                const priorityA =
                    PRIORITY_RANK[
                    ticketA.priority
                    ] ?? 0;

                const priorityB =
                    PRIORITY_RANK[
                    ticketB.priority
                    ] ?? 0;

                if (
                    queueFilters.sort ===
                    "priority_desc"
                ) {
                    if (
                        priorityA !== priorityB
                    ) {
                        return (
                            priorityB -
                            priorityA
                        );
                    }

                    return updatedB - updatedA;
                }

                if (
                    queueFilters.sort ===
                    "priority_asc"
                ) {
                    if (
                        priorityA !== priorityB
                    ) {
                        return (
                            priorityA -
                            priorityB
                        );
                    }

                    return updatedB - updatedA;
                }

                if (
                    queueFilters.sort ===
                    "updated_asc"
                ) {
                    return updatedA - updatedB;
                }

                if (
                    queueFilters.sort ===
                    "created_asc"
                ) {
                    return createdA - createdB;
                }

                if (
                    queueFilters.sort ===
                    "created_desc"
                ) {
                    return createdB - createdA;
                }

                return updatedB - updatedA;
            }
        );
    }, [
        tickets,
        queueFilters,
        queueView,
        currentUserId,
    ]);

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
                        {visibleTickets.length} of {" "}
                        {tickets.length} displayed
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
                    onClick={() => {
                        setQueueView("active");
                    }}
                >
                    <span>Active</span>
                    <span className="ticket-queue-count">
                        {queueCounts.active}
                    </span>
                </button>

                <button
                    type="button"
                    className={
                        queueView === "all"
                            ? "ticket-queue-view active"
                            : "ticket-queue-view"
                    }
                    onClick={() => {
                        setQueueView("all")
                    }}
                >
                    <span>All Tickets</span>

                    <span className="ticket-queue-count">
                        {queueCounts.all}
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
                    }}
                    disabled={!currentUserId}
                >

                    <span>My Tickets</span>

                    <span className="ticket-queue-count">
                        {currentUserId
                            ? queueCounts.mine
                            : "-"}
                    </span>
                </button>

                <button
                    type="button"
                    className={
                        queueView === "unassigned"
                            ? "ticket-queue-view active"
                            : "ticket-queue-view"
                    }
                    onClick={() => {
                        setQueueView(
                            "unassigned"
                        );
                    }}
                >
                    <span>Unassigned</span>
                    <span className="ticket-queue-count">
                        {queueCounts.unassigned}
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
                                    onClick={() => {
                                        openTicket(ticketId);
                                    }}
                                    disabled={isSelected}
                                >
                                    {isSelected
                                        ? "Details open"
                                        : "View details"
                                    }
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
        </section>
    );
}
