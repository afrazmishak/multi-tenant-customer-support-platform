import { useState } from "react";

import { createTicketMessageRequest, } from "../api/ticketMessageApi.js"

import "./TicketMessageComposer.css"

export default function TicketMessageComposer({
    workspaceSlug,
    ticketId,
    ticketStatus,
    onMessageCreated,
}) {
    const [messageType, setMessageType] = useState("public_reply");
    const [body, setBody] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const isClosed = ticketStatus === "closed";

    async function handleSubmit(event) {
        event.preventDefault();

        const normaizedBody = body.trim();

        if (!normaizedBody) {
            setError(
                "Enter a message before sending."
            );

            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const result =
                await createTicketMessageRequest(
                    workspaceSlug,
                    ticketId,
                    {
                        type: messageType,
                        body: normaizedBody,
                    }
                );

            const createdMessage =
                result?.data?.message;

            if (!createdMessage) {
                throw new Error(
                    "The server did not return the created message."
                );
            }

            onMessageCreated(createdMessage);

            setBody("");
        } catch (error) {
            setError(error.message);
        } finally {
            setIsSubmitting(false);
        }
    }

    if (isClosed) {
        return (
            <div className="ticket-composer-closed">
                <strong>
                    Ticket closed
                </strong>

                <p>
                    Closed tickets cannot receive new replies or internal notes.
                </p>
            </div>
        );
    }

    return (
        <form className="ticket-message-composer" onSubmit={handleSubmit}>
            <div className="ticket-composer-type">
                <button
                    type="button"
                    className={
                        messageType === "public_reply"
                            ? "ticket-composer-tab active"
                            : "ticket-composer-tab"
                    }
                    onClick={() => {
                        setMessageType(
                            "public_reply"
                        );
                    }}
                    disabled={isSubmitting}
                >
                    Public reply
                </button>

                <button
                    type="button"
                    className={
                        messageType === "internal_note"
                            ? "ticket-composer-tab active"
                            : "ticket-composer-tab"
                    }

                    onClick={() => {
                        setMessageType(
                            "internal_note"
                        );
                    }}
                    disabled={isSubmitting}
                >
                    Internal note
                </button>
            </div>

            <div
                className={
                    messageType === "internal_note"
                        ? "ticket-composer-editor internal"
                        : "ticket-composer-editor"
                }
            >
                <label htmlFor={`message-${ticketId}`}>
                    {messageType === "internal_note"
                        ? "Internal note"
                        : "Reply to customer"
                    }
                </label>

                <textarea
                    id={`message-{$ticketId}`}
                    value={body}
                    onChange={(event) => {
                        setBody(
                            event.target.value
                        );
                    }}

                    placeholder={
                        messageType === "internal_note"
                            ? "Write a note for your support team..."
                            : "Write a reply..."
                    }
                    rows={5}
                    disabled={isSubmitting}
                />

                {messageType === "internal_note" && (
                    <p className="ticket-composer-warning">
                        Internal notes are for workspace members only.
                    </p>
                )}
            </div>

            {error && (
                <p className="ticket-composer-error" role="alert">
                    {error}
                </p>
            )}

            <div className="ticket-composer-actions">
                <button
                    type="submit"
                    className="button"
                    disabled={
                        isSubmitting ||
                        !body.trim()
                    }
                >
                    {isSubmitting
                        ? "Sending..."
                        : messageType ===
                            "internal_note"
                            ? "Add internal note"
                            : "Send reply"
                    }
                </button>
            </div>
        </form>
    );
}