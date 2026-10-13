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

    const canClose =
        status === "resolved";

    const canReopen =
        status === "resolved" ||
        status === "closed";

    async function changeStatus(input) {
        setIsUpdating(true);
        setError(null);

        try {
            await updateTicketStatusRequest(
                workspaceSlug,
                ticketId,
                input
            );

            return true;
        } catch (requestError) {
            setError(
                requestError.message
            );

            return false;
        } finally {
            setIsUpdating(false);
        }
    }

    async function handleResolve() {
        const normalizedSummary =
            resolutionSummary.trim();

        if (!normalizedSummary) {
            setError(
                "Please enter a resolution summary"
            );

            return;
        }

        const succeeded =
            await changeStatus({
                status: "resolved",

                resolutionSummary:
                    normalizedSummary,
            });

        if (succeeded) {
            setResolutionSummary("");
        }
    }

    async function handleClose() {
        await changeStatus({
            status: "closed",
        });
    }

    async function handleReopen() {
        await changeStatus({
            status: "open",
        });
    }

    if (
        !canResolve &&
        !canClose &&
        !canReopen
    ) {
        return null;
    }

    return (
        <section className="ticket-lifecycle-control">
            <h4>Ticket lifecycle</h4>

            {canResolve && (
                <div className="ticket-lifecycle-action">
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
                </div>
            )}

            {canClose && (
                <div className="ticket-lifecycle-action">
                    <h5>Close ticket</h5>
                    <p>Close this resolved ticket when no more work is required.</p>

                    <button
                        type="button"
                        className="button button-primary"
                        onClick={
                            handleClose
                        }
                        disabled={
                            isUpdating
                        }
                    >
                        {isUpdating
                            ? "Updating..."
                            : "Close ticket"}
                    </button>
                </div>
            )}

            {canReopen && (
                <div className="ticket-lifecycle-action">
                    <h5>Reopen ticket</h5>
                    <p>Return this ticket to active support.</p>
                    <button
                        type="button"
                        className="button button-secondary"
                        onClick={handleReopen}
                        disabled={isUpdating}
                    >
                        {isUpdating
                            ? "Updating..."
                            : "Reopen ticket"}
                    </button>
                </div>
            )}

            {error && (
                <p role="alert">
                    Unable to update
                    ticket: {error}
                </p>
            )}
        </section>
    );
}