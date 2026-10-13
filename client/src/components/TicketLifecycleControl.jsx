import {
    useState
} from "react";

import {
    updateTicketStatusRequest,
} from "../api/ticketApi.js";

export default function TicketLifecycleControl({
    workspaceSlug,
    ticketId,
    ticket
}) {
    const [
        resolutionSummary,
        setResolutionSummary,
    ] = useState("");

    const [
        isUpdating,
        setIsUpdating,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState(null);

    const status =
        ticket?.status;

    const canResolve =
        status === "open" ||
        status === "in_progress";

    async function handleResolve() {
        const normalizedSummary =
            resolutionSummary.trim();

        if (!normalizedSummary) {
            setError(
                "Please enter a resolution summary"
            );

            return;
        }

        setIsUpdating(true);
        setError(null);

        try {
            await updateTicketStatusRequest(
                workspaceSlug,
                ticketId,
                {
                    status: "resolved",
                    resolutionSummary:
                        normalizedSummary,
                }
            );

            setResolutionSummary("");
        } catch (requestError) {
            setError(
                requestError.message
            );
        } finally {
            setIsUpdating(false);
        }
    }

    if (!canResolve) {
        return null;
    }

    return (
        <section className="ticket-lifecycle-control">
            <h4>Resolve ticket</h4>
            <p>Complete the ticket and record how the issue was resolved.</p>

            <label htmlFor={`resolution-summary-${ticketId}`}>
                Resolution summary
            </label>

            <textarea
                id={`resolution-summary-${ticketId}`}
                value={resolutionSummary}
                onChange={(event) => {
                    setResolutionSummary(
                        event.target.value
                    );
                }}
                placeholder="Explain how this ticket was resolved..."
                rows={4}
                disabled={isUpdating}
            />

            <button
                type="button"
                className="button button-primary"
                onClick={
                    handleResolve
                }
                disabled={
                    isUpdating
                }
            >
                {isUpdating
                    ? "Resolving..."
                    : "Resolve ticket"}
            </button>

            {error && (
                <p role="alert">
                    {error}
                </p>
            )}
        </section>
    );
}