export function createSlug(value) {
    if (typeof value !== "string") {
        return "";
    }

    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "-")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}