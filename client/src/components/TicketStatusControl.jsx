import {
    useState,
} from "react";

import {
    updateTicketStatusRequest,
} from "../api/ticketApi.js";

const BASIC_STATUS_OPTION = [
    {
        value: "open",
        label: "Open",
    },
    {
        value: "in_progress",
        label: "In Progress",
    },
];

function formatLabel(value) {
    if (!value) {
        return "Unknown";
    }

    return String(value)
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            (character) =>
                character.toUpperCase()
        );
}

export default function TicketStatusControl({
    workspaceSlug,
    ticketId,
    status,
}) {
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState(null);

    async function handleStatusChange(event) {
        const nextStatus = event.target.value;

        if (
            !nextStatus ||
            nextStatus === status
        ) {
            return;
        }

        setIsUpdating(true);
        setError(null);

        try {
            await updateTicketStatusRequest(
                workspaceSlug,
                ticketId,
                {
                    status:
                        nextStatus,
                }
            );
        } catch (requestError) {
            setError(
                requestError.message
            );
        } finally {
            setIsUpdating(false);
        }
    }

    const currentStatusIsBasic =
        BASIC_STATUS_OPTION.some(
            (option) =>
                option.value === status
        );

    return (
        <section className="ticket-status-control">
            <label htmlFor={`ticket-status-${ticketId}`}>
                Change  status
            </label>

            <select
                id={`ticket-status-${ticketId}`}
                value={status ?? ""}
                onChange={handleStatusChange}
                disabled={isUpdating}
            >
                {!currentStatusIsBasic &&
                    status && (
                        <option
                            value={status}
                            disabled
                        >{formatLabel(status)}</option>
                    )}

                {BASIC_STATUS_OPTION.map(
                    (option) => (
                        <option
                            key={option.key}
                            value={option.value}
                        >
                            {option.label}
                        </option>
                    )
                )}
            </select>

            {isUpdating && (
                <p>Updating status...</p>
            )}

            {error && (
                <p role="alert">
                    Unable to update status: {error}
                </p>
            )}
        </section>
    )
}