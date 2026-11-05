import { useEffect, useState } from "react";
import { fetchTickets } from "../api/tickets.js";

export function useTickets({
    workspaceSlug,
    view = "active",
    page = 1,
    limit = 25,
    sort = "updated_desc",
    search = "",
    priority = "",
    status = "",
}) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        fetchTickets({
            workspaceSlug,
            view,
            page,
            limit,
            sort,
            search,
            priority,
            status,
        })
            .then((result) => {
                if (!cancelled) {
                    setData(result);
                    setError(null);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err.message);
                    setData(null);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [
        workspaceSlug,
        view,
        page,
        limit,
        sort,
        search,
        priority,
        status,
    ]);

    return {
        tickets: data?.tickets ?? [],
        pagination: data?.pagination ?? null,
        filters: data?.filters ?? null,
        loading,
        error,
    };
}