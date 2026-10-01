import {
    useEffect,
    useState,
} from "react";

import {
    getTicketMessagesRequest,
} from "../api/ticketMessageApi.js";

import {
    useWorkspacePresence,
} from "../context/WorkspacePresenceContext.js";

import "./TicketMessageTimeline.css";

function formatDateTime(value) {
    if (!value) {
        return "Date unavailable";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Date unavailable";
    }

    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function getEntityId(value) {
    if (!value) {
        return null;
    }

    if (typeof value === "string") {
        return value;
    }

    return String(
        value.id ?? value._id ?? ""
    ) || null;
}

export default function TicketMessageTimeline({
    workspaceSlug,
    ticketId,
}) {
    const {
        members,
        directoryLoading,
    } = useWorkspacePresence();

    const [messageState, setMessageState] =
        useState({
            ticketId: null,
            messages: [],
            error: null,
        });

    useEffect(() => {
        if (!workspaceSlug || !ticketId) {
            return;
        }

        const controller =
            new AbortController();

        let cancelled = false;

        async function loadMessages() {
            try {
                const result =
                    await getTicketMessagesRequest(
                        workspaceSlug,
                        ticketId,
                        {
                            signal:
                                controller.signal,
                        }
                    );

                const messages =
                    result?.data?.messages;

                if (!Array.isArray(messages)) {
                    throw new Error(
                        "Unexpected message API response: " +
                        "data.messages must be an array"
                    );
                }

                if (!cancelled) {
                    setMessageState({
                        ticketId,
                        messages,
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

                setMessageState({
                    ticketId,
                    messages: [],
                    error: error.message,
                });
            }
        }

        loadMessages();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [workspaceSlug, ticketId]);

    const isLoading =
        messageState.ticketId !== ticketId;

    const messages = isLoading
        ? []
        : messageState.messages;

    const error = isLoading
        ? null
        : messageState.error;

    const memberMap = new Map(
        members.map((member) => [
            String(member.user.id),
            member,
        ])
    );

    return (
        <section className="ticket-message-timeline">
            <header className="ticket-message-header">
                <div>
                    <h4>Conversation</h4>

                    <p>
                        Public replies and internal
                        support notes for this ticket.
                    </p>
                </div>

                {!isLoading && !error && (
                    <span className="ticket-message-count">
                        {messages.length} messages
                    </span>
                )}
            </header>

            {isLoading ? (
                <p>Loading conversation...</p>
            ) : error ? (
                <p role="alert">
                    Unable to load conversation:{" "}
                    {error}
                </p>
            ) : messages.length === 0 ? (
                <div className="ticket-message-empty">
                    <strong>
                        No messages yet
                    </strong>

                    <p>
                        This ticket does not have any
                        conversation history yet.
                    </p>
                </div>
            ) : (
                <ol className="ticket-message-list">
                    {messages.map((message) => {
                        const authorId =
                            getEntityId(
                                message.authorUser
                            );

                        const author =
                            authorId
                                ? memberMap.get(
                                    authorId
                                )
                                : null;

                        const authorName =
                            author?.user?.name ??
                            (
                                directoryLoading
                                    ? "Loading author..."
                                    : "Support member"
                            );

                        const isInternal =
                            message.isInternal === true ||
                            message.type ===
                            "internal_note";

                        return (
                            <li
                                key={
                                    message.id ??
                                    message._id
                                }
                                className={
                                    isInternal
                                        ? "ticket-message ticket-message-internal"
                                        : "ticket-message ticket-message-public"
                                }
                            >
                                <div className="ticket-message-meta">
                                    <strong>
                                        {authorName}
                                    </strong>

                                    <span
                                        className={
                                            isInternal
                                                ? "message-type message-type-internal"
                                                : "message-type message-type-public"
                                        }
                                    >
                                        {isInternal
                                            ? "Internal note"
                                            : "Public reply"}
                                    </span>

                                    <time>
                                        {formatDateTime(
                                            message.createdAt
                                        )}
                                    </time>
                                </div>

                                <p className="ticket-message-body">
                                    {message.body}
                                </p>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}