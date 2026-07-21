import mongoose from "mongoose";

import {
    MEMBERSHIP_ROLES,
    MEMBERSHIP_ROLE_VALUES,
    MEMBERSHIP_STATUSES,
    MEMBERSHIP_STATUS_VALUES,
} from "../constants/membership.constants.js";

const membershipSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tenant",
            required: [true, "Tenant ID is required"],
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "User ID is required"],
        },

        role: {
            type: String,
            enum: {
                values: MEMBERSHIP_ROLE_VALUES,
                message: "Invalid membership role: {VALUE}",
            },
            default: MEMBERSHIP_ROLES.AGENT,
        },

        status: {
            type: String,
            enum: {
                values: MEMBERSHIP_STATUS_VALUES,
                message: "Invalid membership status: {VALUE}",
            },
            default: MEMBERSHIP_STATUSES.ACTIVE,
        },

        joinedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

membershipSchema.index(
    {
        tenantId: 1,
        userId: 1,
    },
    {
        unique: true,
        name: "unique_tenant_user_membership",
    }
);

membershipSchema.index(
    {
        userId: 1,
        status: 1,
    },
    {
        name: "user_active_memberships",
    }
);

membershipSchema.index(
    {
        tenantId: 1,
        role: 1,
        status: 1,
    },
    {
        name: "tenant_members_by_role",
    }
);

const Membership = mongoose.model("Membership", membershipSchema);

export default Membership;