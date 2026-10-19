import { useEffect, useState } from "react";
import { socket, } from "../socket/socket.js";

import {
    getTicketByIdRequest,
} from "../api/ticketApi.js";

import {
    useWorkspacePresence,
} from "../context/WorkspacePresenceContext.js";

import TicketMessageTimeline from "./TicketMessageTimeline.jsx";
import TicketActivityTimeline from "./TicketActivityTimeline.jsx";
import TicketStatusControl from "./TicketStatusControl.jsx";
import TicketAssignmentControl from "./TicketAssignmentControl.jsx";
import TicketLifecycleControl from "./TicketLifecycleControl.jsx";
import TicketPriorityControl from "./TicketPriorityControl.jsx";
import TicketMetadataEditor from "./TicketMetadataEditor.jsx";
import TicketDescriptionEditor from "./TicketDescriptionEditor.jsx";

import "./TicketDetailsPanel.css";

function formatLabel(value) {
    if (!value) return "Not specified";

    return String(value)
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) =>
            character.toUpperCase()
        );
}

function formatDate(value) {
    if (!value) return "Unavailable";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Unavailable";
    }

    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function getEntityId(value) {
    if (!value) return null;

    if (typeof value === "string") {
        return value;
    }

    return String(value.id ?? value._id ?? "") || null;
}

export default function TicketDetailsPanel({
    workspaceSlug,
    ticketId,
    realtimeTicket,
    onClose,
}) {
    const { members } = useWorkspacePresence();

    const [detailState, setDetailState] = useState({
        ticketId: null,
        ticket: null,
        error: null,
    });

    const [activeTab, setActiveTab] = useState("conversation");

    useEffect(() => {
        if (!workspaceSlug || !ticketId) {
            return;
        }

        const controller = new AbortController();
        let cancelled = false;

        async function loadTicket() {
            try {
                const result = await getTicketByIdRequest(
                    workspaceSlug,
                    ticketId,
                    {
                        signal: controller.signal,
                    }
                );

                if (!result?.data?.ticket) {
                    throw new Error(
                        "Unexpected API response: data.ticket is missing"
                    );
                }

                if (!cancelled) {
                    setDetailState({
                        ticketId,
                        ticket: result.data.ticket,
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

                setDetailState({
                    ticketId,
                    ticket: null,
                    error: error.message,
                });
            }
        }

        loadTicket();

        return () => {
            cancelled = true;
            controller.abort();
        };

    }, [workspaceSlug, ticketId]);

    useEffect(() => {
        if (
            !workspaceSlug ||
            !ticketId
        ) {
            return;
        }

        function joinTicketRoom() {
            socket.emit(
                "ticket:join",
                {
                    ticketId,
                },
                (response) => {
                    if (!response?.success) {
                        console.error(
                            "Unable to join ticket room",
                            response
                        );
                    }
                }
            );
        }

        if (socket.connected) {
            joinTicketRoom();
        }

        socket.on(
            "connect",
            joinTicketRoom
        );

        return () => {
            socket.off(
                "connect",
                joinTicketRoom
            );

            if (socket.connected) {
                socket.emit(
                    "ticket:leave",
                    {
                        ticketId,
                    }
                );
            }
        };
    }, [
        workspaceSlug,
        ticketId
    ]);

    const isLoading =
        detailState.ticketId !== ticketId;

    const realtimeTicketId =
        getEntityId(realtimeTicket);

    const isMatchingRealtimeTicket =
        Boolean(
            realtimeTicket &&
            realtimeTicketId &&
            String(realtimeTicketId) ===
            String(ticketId)
        );

    const ticket = isLoading
        ? null
        : isMatchingRealtimeTicket
            ? {
                ...detailState.ticket,
                ...realtimeTicket,

                customer:
                    typeof realtimeTicket.customer === "object"
                        ? realtimeTicket.customer
                        : detailState.ticket?.customer ??
                        realtimeTicket.customer,
            }
            : detailState.ticket;

    const error = isLoading
        ? null
        : detailState.error;

    const assigneeId = getEntityId(
        ticket?.assignedTo
    );

    const assignee =
        (members ?? []).find(
            (member) =>
                String(
                    member?.user?.id ?? ""
                ) === assigneeId
        );

    const customer =
        ticket?.customer &&
            typeof ticket.customer === "object"
            ? ticket.customer.name ??
            getEntityId(ticket.customer)
            : ticket?.customer ?? "Not specified";

    return (
        <section
            className="ticket-details"
            aria-label="Ticket details"
        >
            <div className="ticket-details-sticky-top">
                <header className="ticket-details-header">
                    <div className="ticket-details-heading">
                        <span className="ticket-details-reference">
                            {ticket
                                ? ticket.reference ??
                                `#${ticket.ticketNumber}`
                                : "Ticket Details"}
                        </span>

                        {ticket && (
                            <h3>{ticket.subject}</h3>
                        )}
                    </div>

                    <button type="button"
                        className="button button-secondary"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </header>

                {ticket && (
                    <div className="ticket-details-summary">
                        <span>
                            <strong>Status:</strong>{" "}
                            {formatLabel(ticket.status)}
                        </span>

                        <span>
                            <strong>Priority:</strong>{" "}
                            {formatLabel(ticket.priority)}
                        </span>

                        <span>
                            <strong>Assigned:</strong>{" "}
                            {!assigneeId
                                ? "Unassigned"
                                : assignee?.user?.name ??
                                "Unavailable"}
                        </span>
                    </div>
                )}
            </div>

            {isLoading ? (
                <p>Loading ticket details...</p>
            ) : error ? (
                <p role="alert">
                    Unable to load ticket: {error}
                </p>
            ) : ticket ? (
                <>

                    <div className="ticket-details-grid">
                        <div>
                            <span>Status</span>
                            <strong>
                                {formatLabel(ticket.status)}
                            </strong>
                        </div>

                        <div>
                            <span>Priority</span>
                            <strong>
                                {formatLabel(ticket.priority)}
                            </strong>
                        </div>

                        <div>
                            <span>Assigned to</span>
                            <strong>
                                {!assigneeId
                                    ? "Unassigned"
                                    : assignee?.user.name ??
                                    "Assigned member unavailable"}
                            </strong>
                        </div>

                        <div>
                            <span>Customer</span>
                            <strong>{customer}</strong>
                        </div>

                        <div>
                            <span>Created</span>
                            <strong>
                                {formatDate(ticket.createdAt)}
                            </strong>
                        </div>

                        <div>
                            <span>Last updated</span>
                            <strong>
                                {formatDate(ticket.updatedAt)}
                            </strong>
                        </div>
                    </div>

                    <div className="ticket-description">
                        <h4>Description</h4>

                        <p>
                            {ticket.description ??
                                "No description available."}
                        </p>
                    </div>

                    {Array.isArray(ticket.tags) &&
                        ticket.tags.length > 0 && (
                            <div>
                                <h4>Tags</h4>

                                <p>
                                    {ticket.tags.join(", ")}
                                </p>
                            </div>
                        )}

                    <TicketMetadataEditor
                        workspaceSlug={workspaceSlug}
                        ticketId={ticketId}
                        ticket={ticket}
                    />

                    <TicketDescriptionEditor
                        workspaceSlug={workspaceSlug}
                        ticketId={ticketId}
                        ticket={ticket}
                    />

                    <div className="ticket-action-panel">
                        <TicketStatusControl
                            workspaceSlug={workspaceSlug}
                            ticketId={ticketId}
                            status={ticket.status}
                        />

                        <TicketPriorityControl
                            workspaceSlug={workspaceSlug}
                            ticketId={ticketId}
                            priority={ticket.priority}
                        />

                        <TicketAssignmentControl
                            workspaceSlug={workspaceSlug}
                            ticketId={ticketId}
                            assignedTo={ticket.assignedTo}
                        />

                        <TicketLifecycleControl
                            workspaceSlug={workspaceSlug}
                            ticketId={ticketId}
                            ticket={ticket}
                        />
                    </div>

                    <div className="ticket-details-tabs">
                        <div className="ticket-details-tab-list"
                            role="tablist"
                            aria-label="Ticket information">
                            <button type="button"
                                role="tab"
                                aria-selected={
                                    activeTab === "conversation"
                                }
                                className={
                                    activeTab === "conversation"
                                        ? "ticket-details-tab active"
                                        : "ticket-details-tab"
                                }
                                onClick={() => {
                                    setActiveTab("conversation");
                                }}
                            >
                                Conversation
                            </button>

                            <button type="button"
                                role="tab"
                                aria-selected={
                                    activeTab === "activity"
                                }
                                className={
                                    activeTab === "activity"
                                        ? "ticket-details-tab active"
                                        : "ticket-details-tab"
                                }
                                onClick={() => {
                                    setActiveTab("activity");
                                }}
                            >
                                Activity
                            </button>
                        </div>

                        <div className="ticket-details-tab-content">
                            {activeTab === "conversation" && (
                                <TicketMessageTimeline
                                    workspaceSlug={workspaceSlug}
                                    ticketId={ticketId}
                                    ticketStatus={ticket.status}
                                />
                            )}

                            {activeTab === "activity" && (
                                <TicketActivityTimeline
                                    workspaceSlug={workspaceSlug}
                                    ticketId={ticketId}
                                />
                            )}
                        </div>
                    </div>
                </>
            ) : null}
        </section>
    );
}
