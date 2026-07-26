import { apiRequest } from "./apiClient.js";

export function registerWorkspaceRequest(data) {
    return apiRequest("/auth/register-workspace", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export function loginRequest(data) {
    return apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export function getMeRequest() {
    return apiRequest("/auth/me", {
        method: "GET",
    });
}

export function logoutRequest() {
    return apiRequest("/auth/logout", {
        method: "POST",
    });
}