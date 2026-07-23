import mongoose from "mongoose";

import {
    MEMBERSHIP_ROLES,
    MEMBERSHIP_STATUSES,
} from "../constants/membership.constants.js";
import { Membership, Tenant, User } from "../models/index.js";
import AppError from "../utils/AppError.js";
import { hashPassword } from "../utils/password.js"

export async function createWorkspaceRegistration({
    ownerName,
    ownerEmail,
    password,
    workspaceName,
    workspaceSlug,
}) {
    const passwordHash = await hashPassword(password);

    let registrationResult;

    await mongoose.connection.transaction(async (session) => {
        const existingUser = await User.exists({
            email: ownerEmail,
        }).session(session);

        if (existingUser) {
            throw new AppError(
                "An account with this email already exists",
                409,
                "EMAIL_ADDRESS_EXISTS"
            );
        }

        const existingTenant = await Tenant.exists({
            slug: workspaceSlug,
        }).session(session);

        if (existingTenant) {
            throw new AppError(
                "THis workspace URL is already taken",
                409,
                "WORKSPACE_SLUG_ALREADY_EXISTS"
            );
        }

        const user = new User({
            name: ownerName,
            email: ownerEmail,
            passwordHash,
            status: "active",
        });

        await user.save({ session });

        const tenant = new Tenant({
            name: workspaceName,
            slug: workspaceSlug,
            status: "active",
            createdBy: user._id,
        });

        await tenant.save({ session });

        const membership = new Membership({
            tenantId: tenant._id,
            userId: user._id,
            role: MEMBERSHIP_ROLES.OWNER,
            status: MEMBERSHIP_STATUSES.ACTIVE,
            joinedAt: new Date(),
        });

        await membership.save({ session });

        registrationResult = {
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                status: user.status,
            },

            workspace: {
                id: tenant._id.toString(),
                name: tenant.name,
                slug: tenant.slug,
                status: tenant.status,
            },

            membership: {
                id: membership._id.toString(),
                role: membership.role,
                status: membership.status,
            },
        };
    });

    return registrationResult;
}