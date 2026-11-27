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
    const requestKey = JSON.stringify([
        workspaceSlug,
        view,
        page,
        limit,
        sort,
        search,
        priority,
        status,
    ]);

    const [result, setResult] = useState({
        requestKey: null,
        data: null,
        error: null,
    });

    useEffect(() => {
        if (!workspaceSlug) {
            return;
        }

        const controller = new AbortController();

        fetchTickets({
            workspaceSlug,
            view,
            page,
            limit,
            sort,
            search,
            priority,
            status,
            signal: controller.signal,
        })
            .then((data) => {
                if (controller.signal.aborted) {
                    return;
                }

                setResult({
                    requestKey,
                    data,
                    error: null,
                });
            })
            .catch((error) => {
                if (controller.signal.aborted) {
                    return;
                }

                setResult({
                    requestKey,
                    data: null,
                    error: error.message,
                });
            });

        return () => {
            controller.abort();
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
        requestKey,
    ]);

    const isCurrentResult =
        result.requestKey === requestKey;

    const loading =
        Boolean(workspaceSlug) && !isCurrentResult;

    const data = isCurrentResult
        ? result.data
        : null;

    const error = isCurrentResult
        ? result.error
        : null;

    return {
        tickets: data?.tickets ?? [],
        pagination: data?.pagination ?? null,
        filters: data?.filters ?? null,
        loading,
        error,
    };
}
