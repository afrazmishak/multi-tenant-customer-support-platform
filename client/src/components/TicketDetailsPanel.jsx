import { useEffect, useState } from "react";
import { getTicketByIdRequest, } from "../api/ticketApi.js";
import { useWorkspacePresence } from "../context/WorkspacePresenceContext.js"
import "./TicketInboxPreview.jsx";

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
    onClose,
}) {
    const { members } = useWorkspacePresence();

    const [detailState, setDetailState] = useState({
        ticketId: null,
        ticket: null,
        error: null,
    });

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
                    return
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

    const isLoading = detailState.ticketId !== ticketId;

    const ticket = isLoading
        ? null
        : detailState.ticket;

    const error = isLoading
        ? null
        : detailState.error;

    const assigneeId = getEntityId(
        ticket?.assignedTo
    );

    const assignee = members.find(
        (member) =>
            String(member.user.id) === assigneeId
    );

    const customer =
        ticket?.ticket.customer &&
            typeof ticket.customer === "object"
            ? ticket.customer.name ??
            getEntityId(ticket.customer)
            : ticket?.customer ?? "Not specified";

    return (
        <section className="ticket-details" aria-label="Ticket details">
            <header className="ticket-details-header">
                <h3>Ticket Details</h3>

                <button
                    type="button"
                    className="button"
                    onClick={onClose}
                >
                    Close details
                </button>
            </header>


            {isLoading ? (
                <p>Loading ticket details...</p>
            ) : error ? (
                <p role="alert">
                    Unable to load ticket: {error}
                </p>
            ) : ticket ? (
                <>
                    <p className="ticket-reference">
                        {ticket.reference ??
                            `#${ticket.ticketNumber}`}
                    </p>

                    <h3>{ticket.subject}</h3>

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
                                    "Assigned member unavailable"
                                }
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

                                <p>{ticket.tags.join(", ")}</p>
                            </div>
                        )}
                </>
            ) : null}
        </section>
    );
}