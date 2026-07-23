import {
    MEMBERSHIP_STATUSES,
} from "../constants/membership.constants.js";
import { Membership, User } from "../models/index.js";
import AppError from "../utils/AppError.js";
import { verifyPassword } from "../utils/password.js";

async function getActiveMemberships(userId) {
    const memberships = await Membership.find({
        userId,
        status: MEMBERSHIP_STATUSES.ACTIVE,
    })
        .populate({
            path: "tenantId",
            match: {
                status: "active",
            },
            select: "name slug status",
        })
        .sort({
            createdAt: 1,
        })
        .lean();

    return memberships
        .filter((membership) => membership.tenantId)
        .map((membership) => ({
            id: membership._id.toString(),
            role: membership.role,
            status: membership.status,

            workspace: {
                id: membership.tenantId._id.toString(),
                name: membership.tenantId.name,
                slug: membership.tenantId.slug,
                status: membership.tenantId.status,
            },
        }));
}

export async function authenticateUser({ email, password }) {
    const user = await User.findOne({
        email,
    }).select("+passwordHash");

    if (!user) {
        throw new AppError(
            "Invalid email or password",
            401,
            "INVALID_CREDENTIALS"
        );
    }

    const passwordMatches = await verifyPassword(
        password,
        user.passwordHash
    );

    if (!passwordMatches) {
        throw new AppError(
            "Invalid email or password",
            401,
            "INVALID_CREDENTIALS"
        );
    }

    if (user.status !== "active") {
        throw new AppError(
            "This account is currently disabled",
            403,
            "ACCOUNT_DISABLED"
        );
    }

    const memberships = await getActiveMemberships(user._id);
    const loginTime = new Date();

    await User.updateOne(
        {
            _id: user._id,
        },
        {
            $set: {
                lastLoginAt: loginTime,
            },
        }
    );

    return {
        user: {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            status: user.status,
            lastLoginAt: loginTime,
        },

        memberships,
    };
}