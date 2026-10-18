import {
    useState,
} from "react";

import {
    updateTicketStatusRequest,
} from "../api/ticketApi.js";

const BASIC_STATUS_OPTIONS = [
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
        BASIC_STATUS_OPTIONS.some(
            (option) =>
                option.value === status
        );

    const statusOptions =
        !currentStatusIsBasic && status
            ? [
                {
                    value: status,
                    label: formatLabel(status),
                    disabled: true,
                },
                ...BASIC_STATUS_OPTIONS,
            ]
            : BASIC_STATUS_OPTIONS;

    return (
        <section className="ticket-status-control">
            <label htmlFor={`ticket-status-${ticketId}`}>
                Change status
            </label>

            <select
                id={`ticket-status-${ticketId}`}
                value={status ?? ""}
                onChange={handleStatusChange}
                disabled={
                    isUpdating ||
                    status === "resolved" ||
                    status === "closed"
                }
            >
                {statusOptions.map(
                    (option) => (
                        <option
                            key={option.value}
                            value={option.value}
                            disabled={
                                option.disabled === true
                            }
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