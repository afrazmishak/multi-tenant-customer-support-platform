import {
    getWorkspaceMembers,
} from "../services/workspace.service.js";

export function getWorkspaceContext(req, res) {
    return res.status(200).json({
        success: true,
        message: "Workspace context retrieved successfully",
        data: {
            workspace: req.tenantContext.workspace,
            membership: req.tenantContext.membership,
        },
    });
}

export async function listWorkspaceMembers(req, res) {
    console.log("Tenant context:", req.tenantContext);

    const members = await getWorkspaceMembers(
        req.tenantContext.tenantId
    );

    console.log("Members:", members);

    return res.status(200).json({
        success: true,
        message: "Workspace members retrieved successfully",
        data: {
            workspace: req.tenantContext.workspace,
            count: members.length,
            members,
        },
    });
}