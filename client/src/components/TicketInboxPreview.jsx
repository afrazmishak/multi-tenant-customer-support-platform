
import { useEffect, useState } from "react";

import {
    getWorkspaceTicketsRequest,
} from "../api/ticketApi.js";

export default function TicketInboxPreview({
    workspaceSlug,
}) {
    const [ticketState, setTicketState] = useState({
        workspaceSlug: null,
        tickets: [],
        error: null,
    });

    useEffect(() => {
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

    const isLoading =
        ticketState.workspaceSlug !== workspaceSlug;

    const tickets = isLoading
        ? []
        : ticketState.tickets;

    const error = isLoading
        ? null
        : ticketState.error;

    return (
        <section className="dashboard-panel">
            <h2>Ticket Inbox</h2>

            {isLoading ? (
                <p>Loading tickets...</p>
            ) : error ? (
                <p role="alert">
                    Unable to load tickets: {error}
                </p>
            ) : tickets.length === 0 ? (
                <p>
                    No tickets found in this workspace.
                </p>
            ) : (
                <ul>
                    {tickets.map((ticket) => (
                        <li
                            key={ticket.id ?? ticket._id}
                        >
                            <strong>
                                #{ticket.ticketNumber}
                                {" — "}
                                {ticket.subject ??
                                    ticket.title ??
                                    "Untitled ticket"}
                            </strong>

                            <p>
                                Status: {ticket.status}
                                {" · "}
                                Priority: {ticket.priority}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
