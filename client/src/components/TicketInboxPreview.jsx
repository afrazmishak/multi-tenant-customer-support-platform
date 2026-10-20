import { useEffect, useMemo, useState } from "react";

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

    const visibleTickets = useMemo(() => {
        const search =
            queueFilters.search
                .trim()
                .toLowerCase();

        const filteredTickets =
            tickets.filter((ticket) => {
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

                if (
                    queueFilters.sort ===
                    "updated_asc"
                ) {
                    return updatedA - updatedB;
                }

                return updatedB - updatedA;
            }
        );
    }, [
        tickets,
        queueFilters,
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

                        return (
                            <li className="ticket-item"
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
                                        Priority: {" "}
                                        {formatLabel(ticket.priority)}
                                    </span>

                                    <span>
                                        Updated:{" "}
                                        {formatDate(ticket.updatedAt)}
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
