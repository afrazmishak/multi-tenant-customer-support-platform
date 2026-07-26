import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    getMeRequest,
    loginRequest,
    logoutRequest,
    registerWorkspaceRequest,
} from "../api/authApi.js";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [isBootstrapping, setIsBootstrapping] =
        useState(true);

    const refreshSession = useCallback(async () => {
        try {
            const response = await getMeRequest();
            const nextSession = response.data;

            setSession(nextSession);

            return nextSession;
        } catch (error) {
            if (error.status === 401 || error.status === 403) {
                setSession(null);
                return null;
            }

            throw error;
        }
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function restoreSession() {
            try {
                const response = await getMeRequest();

                if (!cancelled) {
                    setSession(response.data);
                }
            } catch (error) {
                if (!cancelled) {
                    setSession(null);

                    if (
                        error.status !== 401 &&
                        error.status !== 403
                    ) {
                        console.error(
                            "Failed to restore authentication session:",
                            error
                        );
                    }
                }
            } finally {
                if (!cancelled) {
                    setIsBootstrapping(false);
                }
            }
        }

        restoreSession();

        return () => {
            cancelled = true;
        };
    }, []);

    const login = useCallback(async (credentials) => {
        const response = await loginRequest(credentials);

        setSession(response.data);

        return response.data;
    }, []);

    const registerWorkspace = useCallback(
        async (registrationData) => {
            const response = await registerWorkspaceRequest(
                registrationData
            );

            return response.data;
        },
        []
    );

    const logout = useCallback(async () => {
        try {
            await logoutRequest();
        } finally {
            /*
             * Clear local session state even when the network request
             * fails. The protected API remains the source of truth.
             */
            setSession(null);
        }
    }, []);

    const value = useMemo(
        () => ({
            session,
            user: session?.user || null,
            memberships: session?.memberships || [],
            isAuthenticated: Boolean(session?.user),
            isBootstrapping,
            login,
            registerWorkspace,
            logout,
            refreshSession,
        }),
        [
            session,
            isBootstrapping,
            login,
            registerWorkspace,
            logout,
            refreshSession,
        ]
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (context === undefined) {
        throw new Error(
            "useAuth must be used inside an AuthProvider"
        );
    }

    return context;
}