
import {
    createContext,
    useContext,
} from "react";

export const WorkspacePresenceContext =
    createContext(null);

export function useWorkspacePresence() {
    const context = useContext(
        WorkspacePresenceContext
    );

    if (!context) {
        throw new Error(
            "useWorkspacePresence must be used inside the workspace presence provider"
        );
    }

    return context;
}
