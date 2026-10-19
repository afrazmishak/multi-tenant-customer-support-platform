import {
    useEffect,
} from "react";

import TicketDetailsPanel from "./TicketDetailsPanel.jsx"
import "./TicketDetailsDrawer.css";

export default function TicketDetailsDrawer({
    workspaceSlug,
    ticketId,
    realtimeTicket,
    onClose,
}) {
    useEffect(() => {
        function handleKeyDown(event) {
            if (event.key === "Escape") {
                onClose();
            }
        }

        window.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () => {
            window.removeEventListener(
                "keydown",
                handleKeyDown
            );
        };
    }, [onClose]);

    return (
        <div className="ticket-drawer-backdrop"
            onMouseDown={(event) => {
                if (
                    event.target ===
                    event.currentTarget
                ) {
                    onClose();
                }
            }}
        >
            <aside className="ticket-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Ticket details">
                <TicketDetailsPanel
                    workspaceSlug={workspaceSlug}
                    ticketId={ticketId}
                    realtimeTicket={realtimeTicket}
                    onClose={onClose}
                />
            </aside>
        </div>
    );
}