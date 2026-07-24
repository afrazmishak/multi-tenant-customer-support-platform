import {
    MEMBERSHIP_STATUSES,
} from "../constants/membership.constants.js";
import { Membership } from "../models/index.js";

export async function getWorkspaceMembers(tenantId) {
    const memberships = await Membership.find({
        tenantId,
        status: MEMBERSHIP_STATUSES.ACTIVE,
    })
        .select(
            "userId role status joinedAt createdAt updatedAt"
        )
        .populate({
            path: "userId",
            select: "name email status lastLoginAt createdAt updatedAt",
        })
        .sort({
            createdAt: 1,
        })
        .lean();

    return memberships
        .filter((membership) => membership.userId)
        .map((membership) => {
            const user = membership.userId;

            return {
                id: membership._id.toString(),
                role: membership.role,
                status: membership.status,
                joinedAt: membership.joinedAt,
                createdAt: membership.createdAt,
                updatedAt: membership.updatedAt,

                user: {
                    id: user._id.toString(),
                    name: user.name,
                    email: user.email,
                    status: user.status,
                    lastLoginAt: user.lastLoginAt ?? null,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                },
            }
        });
}