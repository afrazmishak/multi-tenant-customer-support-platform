import {
    useState,
} from "react";

import {
    updateTicketAssignmentRequest,
} from "../api/ticketApi.js";

import {
    useWorkspacePresence,
} from "../context/WorkspacePresenceContext.js";

function getEntityId(value) {
    if (!value) {
        return null;
    }

    if (typeof value === "string") {
        return value;
    }

    return String(
        value.id ??
        value._id ??
        ""
    ) || null;
}

export default function TicketAssignmentControl({
    workspaceSlug,
    ticketId,
    assignedTo,
}) {
    const {
        members,
        directoryLoading,
    } = useWorkspacePresence();

    const [
        isUpdating,
        setIsUpdating,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState(null);

    const currentAssgineeId =
        getEntityId(assignedTo) ?? "";

    const assignableMembers =
        (members ?? []).filter((member) => {
            const role =
                String(
                    member.role ?? ""
                ).toLowerCase();

            return [
                "owner",
                "admin",
                "agent"
            ].includes(role);
        });

    async function handleAssignmentChange(
        event
    ) {
        const nextAssigneeId =
            event.target.value;

        if (
            nextAssigneeId ===
            currentAssgineeId
        ) {
            return;
        }

        setIsUpdating(true);
        setError(null);

        try {
            await updateTicketAssignmentRequest(
                workspaceSlug,
                ticketId,
                {
                    assignedTo:
                        nextAssigneeId ||
                        null,
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
        <section className="ticket-assignment-control">
            <label htmlFor={`ticket-assignment-${ticketId}`}>
                Assign ticket
            </label>

            <select
                id={`ticket-assignment-${ticketId}`}
                value={currentAssgineeId}
                onChange={handleAssignmentChange}
                disabled={
                    directoryLoading ||
                    isUpdating
                }
            >
                <option value="">
                    Unassigned
                </option>

                {assignableMembers.map((member) => {
                    const userId =
                        String(
                            member?.user?.id ?? ""
                        );

                    const userName =
                        member?.user?.name ??
                        "Unnamed member";

                    const role =
                        String(
                            member?.role ?? ""
                        ).toUpperCase();

                    if (!userId) {
                        return null;
                    }

                    return (
                        <option
                            key={userId}
                            value={userId}
                        >
                            {`${userName} (${role})`}
                        </option>
                    );
                })}
            </select>

            {directoryLoading && (
                <p>Loading workspace members...</p>
            )}

            {isUpdating && (
                <p role="alert">
                    Unable to update assignment: {error}
                </p>
            )}
        </section>
    );
}