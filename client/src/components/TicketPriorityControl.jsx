import {
    useState,
} from "react";

import {
    updateTicketRequest,
} from "../api/ticketApi.js";

const PRIORITY_OPTIONS = [
    {
        value: "low",
        label: "Low",
    },
    {
        value: "normal",
        label: "Normal",
    },
    {
        value: "high",
        label: "High",
    },
    {
        value: "urgent",
        label: "Urgent",
    },
];

export default function TicketPriorityControl({
    workspaceSlug,
    ticketId,
    priority,
}) {
    const [
        isUpdating,
        setIsUpdating,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState(null);

    async function handlePriorityChange(
        event
    ) {
        const nextPriority =
            event.target.value;

        if (
            !nextPriority ||
            nextPriority === priority
        ) {
            return;
        }

        setIsUpdating(true);
        setError(null);

        try {
            await updateTicketRequest(
                workspaceSlug,
                ticketId,
                {
                    priority:
                        nextPriority,
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

    return (
        <section className="ticket-priority-control">
            <label
                htmlFor={`ticket-priority-${ticketId}`}
            >
                Priority
            </label>

            <select
                id={`ticket-priority-${ticketId}`}
                value={priority ?? "normal"}
                onChange={handlePriorityChange}
                disabled={isUpdating}
            >
                {PRIORITY_OPTIONS.map(
                    (option) => (
                        <option
                            key={option.value}
                            value={option.value}
                        >
                            {option.label}
                        </option>
                    )
                )}
            </select>

            {isUpdating && (
                <p>Updating priority...</p>
            )}


            {error && (
                <p role="alert">
                    Unable to update priority: {error}
                </p>
            )};
        </section>
    )
}