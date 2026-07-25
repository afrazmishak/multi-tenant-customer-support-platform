const API_BASE_URL = (
    import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

export class ApiError extends Error {
    constructor(
        message,
        {
            status = 0,
            code = "REQUEST_FAILED",
            errors = null,
        } = {}
    ) {
        super(message);

        this.name = "ApiError";
        this.status = status;
        this.code = code;
        this.errors = errors;
    }
}

export async function apiRequest(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const isFormData = options.body instanceof FormData;

    if (
        options.body &&
        !isFormData &&
        !headers.has("Content-Type")
    ) {
        headers.set("Content-Type", "application/json");
    }

    let response;

    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers,

            credentials: "include",
        });

    } catch {
        throw new ApiError(
            "Unable to reach the server. Confirm that the backend is running.",
            {
                code: "NETWORK_ERROR",
            }
        );
    }

    const rawBody = await response.text();
    let payload = null;

    if (rawBody) {
        try {
            payload = JSON.parse(rawBody);
        } catch {
            throw new ApiError(
                "The server returned an invalid response",
                {
                    status: response.status,
                    code: "INVALID_SERVER_RESPONSE",
                }
            );
        }
    }


    if (!response.ok) {
        throw new ApiError(
            payload?.message || "The request failed",
            {
                status: response.status,
                code: payload?.code || "REQUEST_FAILED",
                error: payload?.errors || null,
            }
        );
    }

}