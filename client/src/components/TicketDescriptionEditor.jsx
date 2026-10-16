import {
    useState
} from "react";

import {
    updateTicketRequest
} from "../api/ticketApi.js";

export default function TicketDescriptionEditor({
    workspaceSlug,
    ticketId,
    ticket
}) {
    const [
        isEditing,
        setIsEditing,
    ] = useState(false);

    const [
        description,
        setDescription,
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
        setDescription(
            ticket?.description ?? ""
        )

        setError(null);
        setIsEditing(true);
    }

    function cancelEditing() {
        setDescription("");
        setError(null);
        setIsEditing(false);
    }

    async function handleSave() {
        const normalizedDescription =
            description.trim();

        if (!normalizedDescription) {
            setError(
                "Ticket description is required"
            );

            return;
        }

        if (
            normalizedDescription ===
            ticket?.description
        ) {
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            await updateTicketRequest(
                workspaceSlug,
                ticketId,
                {
                    description:
                        normalizedDescription,
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
            <section className="ticket-description-editor">
                <h4>Description</h4>
                <p>{ticket?.description}</p>

                <button
                    type="button"
                    className="button button-secondary"
                    onClick={
                        startEditing
                    }
                >Edit description</button>
            </section>
        );
    }

    return (
        <section className="ticket-description-editor">
            <h4>Edit description</h4>
            <label htmlFor={`ticket-description-${ticketId}`}>Description</label>

            <textarea
                id={`ticket-description-${ticketId}`}
                value={description}
                onChange={(event) => {
                    setDescription(
                        event.target.value
                    );
                }}
                rows={8}
                disabled={isSaving}
                placeholder="Describe the customer's issue..."
            />

            <div>
                <button
                    type="button"
                    className="button button-secondary"
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving
                        ? "Saving..."
                        : "Save description"}
                </button>

                <button
                    type="button"
                    className="button button-secondary"
                    onClick={cancelEditing}
                    disabled={isSaving}
                >Cancel</button>
            </div>

            {error && (
                <p role="alert">

                    Unable to update description: {error}
                </p>
            )}
        </section>
    );
}