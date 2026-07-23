import { createWorkspaceRegistration } from "../services/workspaceRegistration.service.js";

export async function registerWorkspace(req, res) {
    const registration = await createWorkspaceRegistration(
        req.validatedBody
    );

    return res.status(201).json({
        success: true,
        message: "Workspace registered successfully",
        data: registration
    });
}