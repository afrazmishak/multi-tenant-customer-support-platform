
import {
    useWorkspacePresence,
} from "../context/WorkspacePresenceContext.js";

export default function WorkspacePresencePanel() {
    const {
        members,
        onlineCount,
        presenceReady,
        directoryLoading,
        directoryError,
    } = useWorkspacePresence();

    return (
        <section className="dashboard-panel">
            <h2>Workspace Members</h2>

            {presenceReady ? (
                <p>{onlineCount} online</p>
            ) : (
                <p>Connecting to live presence...</p>
            )}

            {directoryLoading ? (
                <p>Loading workspace members...</p>
            ) : directoryError ? (
                <p role="alert">
                    Unable to load members:
                    {" "}
                    {directoryError}
                </p>
            ) : members.length === 0 ? (
                <p>No active workspace members found.</p>
            ) : (
                <ul>
                    {members.map((member) => (
                        <li key={member.user.id}>
                            <span aria-hidden="true">
                                {!presenceReady
                                    ? "⏳"
                                    : member.isOnline
                                        ? "🟢"
                                        : "⚪"}
                            </span>

                            {" "}

                            <strong>
                                {member.user.name}
                            </strong>

                            {" — "}

                            {member.role.toUpperCase()}

                            {" · "}

                            {!presenceReady
                                ? "Checking..."
                                : member.isOnline
                                    ? "Online"
                                    : "Offline"}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
