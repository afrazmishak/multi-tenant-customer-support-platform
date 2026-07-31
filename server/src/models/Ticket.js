import mongoose from "mongoose";

import {
    TICKET_LIMITS,
    TICKET_PRIORITIES,
    TICKET_PRIORITY_VALUES,
    TICKET_REFERENCE_PREFIX,
    TICKET_SOURCES,
    TICKET_SOURCE_VALUES,
    TICKET_STATUSES,
    TICKET_STATUS_VALUES,
} from "../constants/ticket.constants.js";

const { Schema } = mongoose;

function normalizeOptionalText(value) {
    if (value === undefined || value === null) {
        return null;
    }

    const normalizedValue = String(value).trim();

    return normalizedValue || null;
}

function normalizeTags(tags) {
    if (!Array.isArray(tags)) {
        return [];
    }

    const normalizedTags = tags
        .map((tag) =>
            String(tag).trim().toLowerCase()
        )
        .filter(Boolean);

    return [...new Set(normalizedTags)];
}

const ticketSchema = new Schema(
    {
        workspace: {
            type: Schema.Types.ObjectId,
            ref: "Workspace",
            required: [
                true,
                "Ticket workspace is required",
            ],
            immutable: true,
        },

        ticketNumber: {
            type: Number,
            required: [
                true,
                "Ticket number is required",
            ],
            immutable: true,
            min: [
                1,
                "Ticket number must be greater than zero",
            ],
            validate: {
                validator(value) {
                    return Number.isSafeInteger(value);
                },
                message:
                    "Ticket number must be a safe integer",
            },
        },

        customer: {
            type: Schema.Types.ObjectId,
            ref: "Customer",
            required: [
                true,
                "Ticket customer is required",
            ],
            immutable: true,
        },

        subject: {
            type: String,
            required: [
                true,
                "Ticket subject is required",
            ],
            trim: true,
            maxlength: [
                TICKET_LIMITS.SUBJECT_MAX_LENGTH,
                `Ticket subject cannot exceed ${TICKET_LIMITS.SUBJECT_MAX_LENGTH} characters`,
            ],
        },

        description: {
            type: String,
            required: [
                true,
                "Ticket description is required",
            ],
            trim: true,
            maxlength: [
                TICKET_LIMITS.DESCRIPTION_MAX_LENGTH,
                `Ticket description cannot exceed ${TICKET_LIMITS.DESCRIPTION_MAX_LENGTH} characters`,
            ],
        },

        status: {
            type: String,
            enum: {
                values: TICKET_STATUS_VALUES,
                message: "Invalid ticket status: {VALUE}",
            },
            default: TICKET_STATUSES.OPEN,
        },

        priority: {
            type: String,
            enum: {
                values: TICKET_PRIORITY_VALUES,
                message: "Invalid ticket priority: {VALUE}",
            },
            default: TICKET_PRIORITIES.NORMAL,
        },

        source: {
            type: String,
            enum: {
                values: TICKET_SOURCE_VALUES,
                message: "Invalid ticket source: {VALUE}",
            },
            default: TICKET_SOURCES.INTERNAL,
            immutable: true,
        },

        category: {
            type: String,
            default: null,
            set: normalizeOptionalText,
            maxlength: [
                TICKET_LIMITS.CATEGORY_MAX_LENGTH,
                `Ticket category cannot exceed ${TICKET_LIMITS.CATEGORY_MAX_LENGTH} characters`,
            ],
        },

        tags: {
            type: [
                {
                    type: String,
                    trim: true,
                    lowercase: true,
                    maxlength: [
                        TICKET_LIMITS.TAG_MAX_LENGTH,
                        `Each ticket tag cannot exceed ${TICKET_LIMITS.TAG_MAX_LENGTH} characters`,
                    ],
                },
            ],
            default: () => [],
            set: normalizeTags,
            validate: {
                validator(tags) {
                    return (
                        tags.length <=
                        TICKET_LIMITS.MAX_TAGS
                    );
                },
                message: `A ticket cannot have more than ${TICKET_LIMITS.MAX_TAGS} tags`,
            },
        },

        assignedTo: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        assignedAt: {
            type: Date,
            default: null,
        },

        assignedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: [
                true,
                "Ticket creator is required",
            ],
            immutable: true,
        },

        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        firstResponseAt: {
            type: Date,
            default: null,
        },

        lastActivityAt: {
            type: Date,
            default: Date.now,
        },

        resolvedAt: {
            type: Date,
            default: null,
        },

        resolvedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        resolutionSummary: {
            type: String,
            default: null,
            set: normalizeOptionalText,
            maxlength: [
                TICKET_LIMITS.RESOLUTION_SUMMARY_MAX_LENGTH,
                `Resolution summary cannot exceed ${TICKET_LIMITS.RESOLUTION_SUMMARY_MAX_LENGTH} characters`,
            ],
        },

        closedAt: {
            type: Date,
            default: null,
        },

        closedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
        optimisticConcurrency: true,

        toJSON: {
            virtuals: true,
        },

        toObject: {
            virtuals: true,
        },
    }
);

ticketSchema.virtual("reference").get(function getReference() {
    if (!Number.isSafeInteger(this.ticketNumber)) {
        return null;
    }

    const paddedNumber = String(
        this.ticketNumber
    ).padStart(6, "0");

    return `${TICKET_REFERENCE_PREFIX}-${paddedNumber}`;
});

ticketSchema.pre(
    "validate",
    function validateTicketIntegrity() {
        /*
         * Assignment integrity
         */
        if (!this.assignedTo) {
            this.assignedAt = null;
            this.assignedBy = null;
        } else {
            if (!this.assignedAt) {
                this.assignedAt = new Date();
            }

            if (!this.assignedBy) {
                this.invalidate(
                    "assignedBy",
                    "assignedBy is required when a ticket is assigned"
                );
            }
        }

        /*
         * Resolution integrity
         */
        const isResolvedOrClosed = [
            TICKET_STATUSES.RESOLVED,
            TICKET_STATUSES.CLOSED,
        ].includes(this.status);

        if (!isResolvedOrClosed) {
            this.resolvedAt = null;
            this.resolvedBy = null;
            this.resolutionSummary = null;
        } else {
            if (!this.resolvedAt) {
                this.resolvedAt = new Date();
            }

            if (!this.resolvedBy) {
                this.invalidate(
                    "resolvedBy",
                    "resolvedBy is required for resolved or closed tickets"
                );
            }
        }

        /*
         * Closure integrity
         */
        if (this.status !== TICKET_STATUSES.CLOSED) {
            this.closedAt = null;
            this.closedBy = null;
        } else {
            if (!this.closedAt) {
                this.closedAt = new Date();
            }

            if (!this.closedBy) {
                this.invalidate(
                    "closedBy",
                    "closedBy is required for closed tickets"
                );
            }
        }
    }
);

ticketSchema.index(
    {
        workspace: 1,
        ticketNumber: 1,
    },
    {
        unique: true,
        name: "unique_ticket_number_per_workspace",
    }
);

ticketSchema.index(
    {
        workspace: 1,
        status: 1,
        priority: 1,
        updatedAt: -1,
        _id: -1,
    },
    {
        name: "ticket_workspace_queue",
    }
);

ticketSchema.index(
    {
        workspace: 1,
        assignedTo: 1,
        status: 1,
        updatedAt: -1,
    },
    {
        name: "ticket_assignee_queue",
    }
);

ticketSchema.index(
    {
        workspace: 1,
        customer: 1,
        createdAt: -1,
    },
    {
        name: "ticket_customer_history",
    }
);

ticketSchema.index(
    {
        workspace: 1,
        tags: 1,
        status: 1,
    },
    {
        name: "ticket_workspace_tags_filter",
    }
);

const Ticket =
    mongoose.models.Ticket ||
    mongoose.model("Ticket", ticketSchema);

export default Ticket;