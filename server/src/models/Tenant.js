import mongoose from "mongoose";

import { createSlug } from "../utils/createSlug.js";

const tenantSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Tenant name is required"],
            trim: true,
            minlength: [2, "Tenant name must contain at least 2 characters"],
            maxlength: [120, "Tenant name cannot exceed 120 characters"],
        },

        slug: {
            type: String,
            required: [true, "Tenant slug is required"],
            trim: true,
            lowercase: true,
            minlength: [2, "Tenant slug must contain at least 2 characters"],
            maxlength: [80, "Tenant slug cannot exceed 80 characters"],
            match: [
                /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                "Tenant slug may contain lowercase letters, numbers and hyphens",
            ],
        },

        status: {
            type: String,
            enum: {
                values: ["active", "suspended"],
                message: "Invalid tenant status: {VALUE}",
            },
            default: "active",
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Tenant creator is required"],
        },
    },
    {
        timestamps: true,
    }
);

tenantSchema.pre("validate", function generateTenantSlug() {
    if (!this.slug && this.name) {
        this.slug = createSlug(this.name);
    }
});

tenantSchema.index(
    { slug: 1 },
    {
        unique: true,
        name: "unique_tenant_slug",
    }
);

tenantSchema.index(
    { status: 1 },
    {
        name: "tenant_status",
    }
);

tenantSchema.index(
    { createdBy: 1 },
    {
        name: "tenant_creator",
    }
);

const Tenant = mongoose.model("Tenant", tenantSchema);

export default Tenant;