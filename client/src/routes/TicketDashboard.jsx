import {
    useWorkspacePresence,
} from "../context/WorkspacePresenceContext.js";

export default function TicketDashboard() {
    const {
        onlineCount,
        presenceReady,
    } = useWorkspacePresence();

    return (
        <div>
            <h2>Ticket Dashboard</h2>

            <p>
                {presenceReady
                    ? `${onlineCount} team members online`
                    : "Checking team presence..."}
            </p>
        </div>
    );
}