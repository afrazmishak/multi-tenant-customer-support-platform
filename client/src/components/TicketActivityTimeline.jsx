import {
    useEffect,
    useState,
} from "react";

import {
    getTicketActivitiesRequest,
} from "../api/ticketApi.js";

import "./TicketActivityTimeline.css"


const ACTIVITY_LABELS = {
    ticket_created:
        "Ticket created",

    ticket_updated:
        "Ticket updated",

    assigned:
        "Ticket assigned",

    unassigned:
        "Ticket unassigned",

    status_changed:
        "Status changed",

    resolved:
        "Ticket resolved",

    reopened:
        "Ticket reopened",

    closed:
        "Ticket closed",

    public_reply_added:
        "Public reply added",

    internal_note_added:
        "Internal note added",

    message_edited:
        "Message edited",
};

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

function formatLabel(value) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return "None";
    }

    if (Array.isArray(value)) {
        return value.length > 0
            ? value.join(", ")
            : "None";
    }

    if (typeof value === "object") {
        return JSON.stringify(value);
    }

    return String(value)
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            (character) =>
                character.toUpperCase()
        );
}

function getActorName(actorUser) {
    if (!actorUser) {
        return "System";
    }

    if (typeof actorUser === "string") {
        return actorUser;
    }

    return (
        actorUser.name ??
        actorUser.username ??
        actorUser.email ??
        "Support member"
    );
}

export default function TicketActivityTimeline({
    workspaceSlug,
    ticketId,
}) {
    const [
        activityState,
        setActivityState,
    ] = useState({
        ticketId: null,
        activities: [],
        error: null,
    });

    useEffect(() => {
        if (
            !workspaceSlug ||
            !ticketId
        ) {
            return;
        }

        const controller =
            new AbortController();

        let cancelled = false;

        async function loadActivities() {
            try {
                const result =
                    await getTicketActivitiesRequest(
                        workspaceSlug,
                        ticketId,
                        {
                            signal:
                                controller.signal,
                        }
                    );

                const activities =
                    result?.data?.activities;

                if (
                    !Array.isArray(
                        activities
                    )
                ) {
                    throw new Error(
                        "Unexpected activity API response: " +
                        "data.activities must be an array"
                    );
                }

                if (!cancelled) {
                    setActivityState({
                        ticketId,
                        activities,
                        error: null,
                    });
                }
            } catch (error) {
                if (
                    cancelled ||
                    controller.signal.aborted ||
                    error?.name === "AbortError"
                ) {
                    return;
                }

                setActivityState({
                    ticketId,
                    activities: [],
                    error: error.message,
                });
            }
        }

        loadActivities();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [
        workspaceSlug,
        ticketId,
    ]);

    const isLoading =
        activityState.ticketId !==
        ticketId;

    const activities = isLoading
        ? []
        : activityState.activities;

    const error = isLoading
        ? null
        : activityState.error;

    return (
        <section
            className="ticket-activity-timeline"
            aria-label="Ticket activity"
        >
            <header className="ticket-activity-header">
                <div>
                    <h4>Activity</h4>

                    <p>
                        Audit history for this ticket.
                    </p>
                </div>

                {!isLoading &&
                    !error && (
                        <span className="ticket-activity-count">
                            {
                                activities.length
                            }{" "}
                            activities
                        </span>
                    )}
            </header>

            {isLoading ? (
                <p>
                    Loading activity...
                </p>
            ) : error ? (
                <p role="alert">
                    Unable to load activity: {error}
                </p>
            ) : activities.length ===
                0 ? (
                <div className="ticket-activity-empty">
                    <strong>
                        No activity yet
                    </strong>

                    <p>No audit history exists for this tickets.</p>
                </div>
            ) : (
                <ol className="ticket-activity-list">
                    {activities.map(
                        (activity) => {
                            const activityId =
                                String(
                                    activity.id ??
                                    activity._id ??
                                    ""
                                );

                            const label =
                                ACTIVITY_LABELS[
                                activity.type
                                ] ??
                                formatLabel(
                                    activity.type
                                );

                            const actorName =
                                getActorName(
                                    activity.actorUser
                                );

                            const changes =
                                Array.isArray(
                                    activity.changes
                                )
                                    ? activity.changes
                                    : [];

                            return (
                                <li
                                    key={
                                        activityId
                                    }
                                    className="ticket-activity-item"
                                >
                                    <div className="ticket-activity-meta">
                                        <strong>
                                            {
                                                label
                                            }
                                        </strong>

                                        <span>
                                            {
                                                actorName
                                            }
                                        </span>

                                        <time>
                                            {formatDateTime(
                                                activity.createdAt
                                            )}
                                        </time>
                                    </div>

                                    {changes.length >
                                        0 && (
                                            <ul className="ticket-activity-changes">
                                                {changes.map(
                                                    (
                                                        change,
                                                        index
                                                    ) => (
                                                        <li
                                                            key={`${activityId}:${change.field}:${index}`}
                                                        >
                                                            <strong>
                                                                {formatLabel(
                                                                    change.field
                                                                )}
                                                            </strong>

                                                            {": "}

                                                            <span>
                                                                {formatLabel(
                                                                    change.from
                                                                )}
                                                            </span>

                                                            {" → "}

                                                            <span>
                                                                {formatLabel(
                                                                    change.to
                                                                )}
                                                            </span>
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                        )}
                                </li>
                            )
                        }
                    )}
                </ol>
            )}
        </section>
    )
}