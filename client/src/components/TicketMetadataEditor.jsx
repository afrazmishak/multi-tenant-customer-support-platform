import {
    useState,
} from "react";

import {
    updateTicketRequest,
} from "../api/ticketApi.js";

export default function TicketMetadataEditor({
    workspaceSlug,
    ticketId,
    ticket
}) {
    const [
        isEditing,
        setIsEditing,
    ] = useState(false);

    const [
        subject,
        setSubject,
    ] = useState("");

    const [
        category,
        setCategory,
    ] = useState("");

    const [
        tags,
        setTags,
    ] = useState("");

    const [
        isSaving,
        setIsSaving,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState(null);

    function startEditing() {
        setSubject(
            ticket?.subject ?? ""
        );

        setCategory(
            ticket?.category ?? ""
        );

        setTags(
            Array.isArray(ticket?.tags)
                ? ticket.tags.join(", ")
                : ""
        );

        setError(null);
        setIsEditing(true);
    }

    function cancelEditing() {
        setError(null);
        setIsEditing(false);
    }

    async function handleSave() {
        const normalizedSubject =
            subject.trim();

        if (!normalizedSubject) {
            setError(
                "Ticket subject is required"
            );

            return;
        }

        const normalizedTags =
            tags
                .split(",")
                .map((tag) =>
                    tag.trim()
                )
                .filter(Boolean);

        setIsSaving(true);
        setError(null);

        try {
            await updateTicketRequest(
                workspaceSlug,
                ticketId,
                {
                    subject:
                        normalizedSubject,

                    category:
                        category.trim() ||
                        null,

                    tags:
                        normalizedTags,
                }
            );

            setIsEditing(false);
        } catch (requestError) {
            setError(
                requestError.message
            );
        } finally {
            setIsSaving(false);
        }
    }

    if (!isEditing) {
        return (
            <section className="ticket-metadata-editor">
                <h4>Ticket information</h4>
                <p>
                    <strong>Subject:</strong>{""}
                    {ticket?.subject}
                </p>

                <p>
                    <strong>Category:</strong>{""}
                    {ticket?.category || "Not specified"}
                </p>

                <div>
                    <strong>Tags:</strong>
                    {Array.isArray(
                        ticket?.tags
                    ) &&
                        ticket.tags.length > 0 ? (
                        <span>
                            {" "}
                            {ticket.tags.join(
                                ", "
                            )}
                        </span>
                    ) : (
                        <span>
                            {" "}
                            No tags
                        </span>
                    )}
                </div>

                <button
                    type="button"
                    className="button button-secondary"
                    onClick={startEditing}
                >Edit ticket information</button>
            </section>
        );
    }

    return (
        <section className="ticket-metadata-editor">
            <h4>Edit ticket information</h4>

            <label htmlFor={`ticket-subject-${ticketId}`}>
                Subject
            </label>

            <input id={`ticket-subject-${ticketId}`}
                type="text"
                value={subject}
                onChange={(event) => {
                    setSubject(
                        event.target.value
                    );
                }}

                disabled={isSaving}
            />

            <label htmlFor={`ticket-category-${ticketId}`}>
                Category
            </label>

            <input
                id={`ticket-category-${ticketId}`}
                type="text"
                value={category}
                onChange={(event) => {
                    setCategory(
                        event.target.value
                    );
                }}
                placeholder="Example: Billing"
                disabled={isSaving}
            />

            <label htmlFor={`ticket-tags-${ticketId}`}>
                Tags
            </label>

            <input
                id={`ticket-tags-${ticketId}`}
                type="text"
                value={tags}
                onChange={(event) => {
                    setTags(
                        event.target.value
                    );
                }}
                placeholder="billing, urgent. refund"
                disabled={isSaving}
            />

            <p>
                Seperate tags with commas.
            </p>

            <div>
                <button
                    type="button"
                    className="button button-primary"
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving
                        ? "Saving"
                        : "Save changes"}
                </button>

                <button
                    type="button"
                    className="button button-secondary"
                    onClick={cancelEditing}
                    disabled={isSaving}
                >
                    Cancel
                </button>
            </div>

            {error && (
                <p role="alert">
                    Unable to update ticket: {error}
                </p>
            )}
        </section>
    );
}