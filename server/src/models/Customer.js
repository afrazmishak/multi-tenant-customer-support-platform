import mongoose, { mongo } from "mongoose";

import {
    CUSTOMER_LIMITS,
    CUSTOMER_STATUSES,
    CUSTOMER_STATUS_VALUES,
} from "../constants/customer.constants.js";

const { Schema } = mongoose;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeOptionalText(value) {
    if (value === undefined || value === null) {
        return null;
    }

    const normalizedValue = String(value).trim();

    return normalizedValue || null;
}

function normalizeEmail(value) {
    const normalizedValue = normalizeOptionalText(value);

    return normalizedValue ? normalizedValue.toLowerCase() : null;
}

function normalizeTags(tags) {
    if (!Array.isArray(tags)) {
        return [];
    }

    const normalizedTags = tags
        .map((tag) => String(tag).trim().toLowerCase())
        .filter(Boolean);

    return [...new Set(normalizeTags)];
}

const customerSchema = new Schema(
    {
        workspace: {
            type: Schema.Types.ObjectId,
            ref: "Workspace",
            required: [true, "Workspace is required"],
            immutable: true,
        },

        name: {
            type: String,
            required: [true, "Customer name is required"],
            trim: true,
            maxlength: [
                CUSTOMER_LIMITS.NAME_MAX_LENGTH,
                    `Customer name cannot exceed ${CUSTOMER_LIMITS.NAME_MAX_LENGTH} characters`,
            ],
        },

        email: {
            type: String,
            default: null,
            set: normalizeEmail,
            maxlength: [
                CUSTOMER_LIMITS.EMAIL_MAX_LENGTH,
                `Email cannot exceed ${CUSTOMER_LIMITS.EMAIL_MAX_LENGTH} characters`,
            ],
            validate: {
                validator(value) {
                    return value === null || EMAIL_PATTERN.test(value);
                },
                message: "Please provide a valid customer email address",
            },
        },

        phone: {
            type: String,
            default: null,
            set: normalizeOptionalText,
            maxlength: [
                CUSTOMER_LIMITS.PHONE_MAX_LENGTH,
                `Phone number cannot exceed ${CUSTOMER_LIMITS.PHONE_MAX_LENGTH} characters`,
            ],
        },

        company: {
            type: String,
            default: null,
            set: normalizeOptionalText,
            maxlength: [
                CUSTOMER_LIMITS.COMPANY_MAX_LENGTH,
                `Company name cannot exceed ${CUSTOMER_LIMITS.COMPANY_MAX_LENGTH} characters`,
            ],
        },

        jobTitle: {
            type: String,
            default: null,
            set: normalizeOptionalText,
            maxlength: [
                CUSTOMER_LIMITS.JOB_TITLE_MAX_LENGTH,
                `Job title cannot exceed ${CUSTOMER_LIMITS.JOB_TITLE_MAX_LENGTH} characters`,
            ],
        },

        status: {
            type: String,
            enum: {
                values: CUSTOMER_STATUS_VALUES,
                message: "Invalid customer status: {VALUE}",
            },
            default: CUSTOMER_STATUSES.ACTIVE,
        },

        tags: {
            type: [
                {
                    type: String,
                    trim: true,
                    lowercase: true,
                    maxlength: [
                        CUSTOMER_LIMITS.TAG_MAX_LENGTH,
                        `Each tag cannot exceed ${CUSTOMER_LIMITS.TAG_MAX_LENGTH} characters`,
                    ],
                },
            ],
            default: [],
            set: normalizeTags,
            validate: {
                validator(tags) {
                    return tags.length <= CUSTOMER_LIMITS.MAX_TAGS;
                },
                message: `A customer cannot have more than ${CUSTOMER_LIMITS.MAX_TAGS} tags`,
            },
        },

        notes: {
            type: String,
            default: null,
            set: normalizeOptionalText,
            maxlength: [
                CUSTOMER_LIMITS.NOTES_MAX_LENGTH,
                `Customer notes cannot exceed ${CUSTOMER_LIMITS.NOTES_MAX_LENGTH} characters`,
            ],
        },

        customFields: {
            type: Map,
            of: Schema.Types.Mixed,
            default: () => new Map(),
            validate: {
                validator(customFields) {
                    return (
                        !customFields ||
                        customFields.size <= CUSTOMER_LIMITS.MAX_CUSTOM_FIELDS
                    );
                },
                message: `A customer cannot have more than ${CUSTOMER_LIMITS.MAX_CUSTOM_FIELDS} custom fields`,
            },
        },

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Customer creator is required"],
        },

        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: "user",
            default: null,
        },

        isArchived: {
            type: Boolean,
            default: false,
        },

        archivedAt: {
            type: Date,
            default: null,
        },

        archivedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
        optimisticConcurrency: true,
    }
);

customerSchema.pre("validate", function validateCustomerIntegrity() {
    if (this.isArchived) {
        if (!this.archivedAt) {
            this.archivedAt = new Date();
        }
    } else {
        this.archivedAt = null;
        this.archivedBy = null;
    }

    if (!this.customFields) {
        return;
    }

    for (const key of this.customFields.keys()) {
        const normalizedKey = String(key).trim();

        if (!normalizedKey) {
            this.invalidate(
                "customFields",
                "Custom field keys cannot be empty"
            );

            continue;
        }

        if (normalizedKey.startsWith("$") || normalizedKey.includes(".")) {
            this.invalidate(
                "customFields",
                `Invalid custom field key: ${normalizedKey}`
            );
        }
    }
});

customerSchema.index(
    {
        workspace: 1,
        email: 1,
    },
    {
        unique: true,
        name: "unique_active_customer_email_per_workspace",
        partialFilterExpression: {
            email: {
                $type: "string",
            },
            isArchived: false,
        },
    }
);

customerSchema.index(
    {
        workspace: 1,
        isArchived: 1,
        status: 1,
        createdAt: -1,
    },
    {
        name: "customer_workspace_status_listing",
    }
);

customerSchema.index(
    {
        workspace: 1,
        isArchived: 1,
        name: 1,
    },
    {
        name: "customer_workspace_name_listing",
    }
);

customerSchema.index(
    {
        workspace: 1,
        isArchived: 1,
        tags: 1,
    },
    {
        name: "customer_workspace_tags_filter",
    }
);

const Customer = 
    mongoose.models.Customer ||
    mongoose.model("Customer", customerSchema);

export default Customer;