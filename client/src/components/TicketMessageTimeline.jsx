import {
    useCallback,
    useEffect,
    useState,
} from "react";

import {
    socket,
} from "../socket/socket.js";

import {
    getTicketMessagesRequest,
    updateTicketMessageRequest,
} from "../api/ticketMessageApi.js";

import {
    useWorkspacePresence,
} from "../context/WorkspacePresenceContext.js";

import TicketMessageComposer from "./TicketMessageComposer.jsx";

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
    ticketStatus,
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

    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editBody, setEditBody] = useState("");
    const [editError, setEditError] = useState(null);
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const handleMessageCreated =
        useCallback(
            (createdMessage) => {
                if (!createdMessage) {
                    return;
                }

                setMessageState((previous) => {
                    if (
                        previous.ticketId !== ticketId
                    ) {
                        return previous;
                    }

                    const createdMessageId =
                        String(
                            createdMessage.id ??
                            createdMessage._id ??
                            ""
                        );

                    const alreadyExists =
                        previous.messages.some(
                            (message) =>
                                String(
                                    message.id ??
                                    message._id ??
                                    ""
                                ) ===
                                createdMessageId
                        );

                    if (alreadyExists) {
                        return previous;
                    }

                    return {
                        ...previous,

                        messages: [
                            ...previous.messages,
                            createdMessage,
                        ],
                    };
                });
            },
            [ticketId]
        );

    const handleMessageUpdated =
        useCallback(
            (updatedMessage) => {
                if (!updatedMessage) {
                    return;
                }

                const updatedMessageId =
                    String(
                        updatedMessage.id ??
                        updatedMessage._id ??
                        ""
                    );

                if (!updatedMessageId) {
                    return;
                }

                setMessageState((previous) => {
                    if (
                        previous.ticketId !== ticketId
                    ) {
                        return previous;
                    }

                    return {
                        ...previous,

                        messages:
                            previous.messages.map(
                                (message) => {
                                    const messageId =
                                        String(
                                            message.id ??
                                            message._id ??
                                            ""
                                        );

                                    return messageId ===
                                        updatedMessageId
                                        ? updatedMessage
                                        : message;
                                }
                            ),
                    }
                });
            },
            [ticketId]
        );

    function startEditingMessage(message) {
        const messageId =
            String(
                message.id ??
                message._id ??
                ""
            );

        if (!messageId) {
            return;
        }

        setEditingMessageId(messageId);
        setEditBody(message.body ?? "");
        setEditError(null);
    }

    function cancelEditingMessage() {
        setEditingMessageId(null);
        setEditBody("");
        setEditError(null);
    }

    async function saveMessageEdit(messageId) {
        const normalizedBody = editBody.trim();

        if (!normalizedBody) {
            setEditError(
                "Message cannot be empty"
            );
            return;
        }

        setIsSavingEdit(true);
        setEditError(null);

        try {
            const result =
                await updateTicketMessageRequest(
                    workspaceSlug,
                    ticketId,
                    messageId,
                    {
                        body: normalizedBody,
                    }
                );

            const updatedMessage =
                result?.data?.message;

            if (updatedMessage) {
                handleMessageUpdated(
                    updatedMessage
                );
            }

            setEditingMessageId(null);
            setEditBody("");
        } catch (error) {
            setEditError(
                error.message ||
                "Unable to update message"
            );
        } finally {
            setIsSavingEdit(false);
        }
    }

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

    useEffect(() => {
        if (!ticketId) {
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

        function handleRealtimeMessageCreated(
            payload
        ) {
            console.log(
                "[ticket:message:created received]",
                payload
            );
            if (!payload) {
                return;
            }

            if (
                String(payload.ticketId) !==
                String(ticketId)
            ) {
                return;
            }

            if (!payload.message) {
                return;
            }

            handleMessageCreated(
                payload.message
            );
        }

        function handleRealtimeMessageUpdated(
            payload
        ) {
            if (!payload) {
                return;
            }

            if (
                String(payload.ticketId) !==
                String(ticketId)
            ) {
                return;
            }

            if (!payload.message) {
                return;
            }

            handleMessageUpdated(
                payload.message
            );
        }

        if (socket.connected) {
            joinTicketRoom();
        }

        socket.on(
            "connect",
            joinTicketRoom
        );

        socket.on(
            "ticket:message:created",
            handleRealtimeMessageCreated
        );

        socket.on(
            "ticket:message:updated",
            handleRealtimeMessageUpdated
        )

        return () => {
            socket.off(
                "connect",
                joinTicketRoom
            );

            socket.off(
                "ticket:message:created",
                handleRealtimeMessageCreated
            );

            socket.off(
                "ticket:message:updated",
                handleRealtimeMessageUpdated
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
        ticketId,
        handleMessageCreated,
        handleMessageUpdated,
    ]);

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

                        const messageId =
                            String(
                                message.id ??
                                message._id ??
                                ""
                            );

                        const isEditing =
                            editingMessageId === messageId;

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

                                {isEditing ? (
                                    <div className="ticket-message-edit">
                                        <textarea
                                            value={editBody}
                                            onChange={(event) => {
                                                setEditBody(
                                                    event.target.value
                                                );
                                            }}
                                            disabled={isSavingEdit}
                                            rows={4}
                                        />

                                        {editError && (
                                            <p className="ticket-message-edit-error">
                                                {editError}
                                            </p>
                                        )}

                                        <div className="ticket-message-edit-actions">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    saveMessageEdit(
                                                        messageId
                                                    );
                                                }}
                                                disabled={isSavingEdit}
                                            >
                                                {isSavingEdit
                                                    ? "Saving"
                                                    : "Save"
                                                }
                                            </button>

                                            <button
                                                type="button"
                                                onClick={
                                                    cancelEditingMessage
                                                }
                                                disabled={isSavingEdit}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <p className="ticket-message-body">
                                            {message.body}
                                        </p>

                                        {message.editedAt && (
                                            <small>
                                                Edited
                                            </small>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => {
                                                startEditingMessage(
                                                    message
                                                );
                                            }}
                                        >
                                            Edit
                                        </button>
                                    </>
                                )}
                            </li>
                        );
                    })}
                </ol>
            )}

            <TicketMessageComposer
                workspaceSlug={workspaceSlug}
                ticketId={ticketId}
                ticketStatus={ticketStatus}
                onMessageCreated={handleMessageCreated}
            />
        </section>
    );
}