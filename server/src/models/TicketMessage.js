import mongoose from "mongoose";

import {
    TICKET_MESSAGE_LIMITS,
    TICKET_MESSAGE_TYPES,
    TICKET_MESSAGE_TYPE_VALUES,
} from "../constants/ticketMessage.constants.js";

const { Schema } = mongoose;

const ticketMessageSchema = new Schema(
    {
        workspace: {
            type: Schema.Types.ObjectId,
            ref: "Workspace",
            required: [
                true,
                "Ticket message workspace is required",
            ],
            immutable: true,
        },

        ticket: {
            type: Schema.Types.ObjectId,
            ref: "Ticket",
            required: [
                true,
                "Ticket message ticket is required",
            ],
            immutable: true,
        },

        type: {
            type: String,
            required: [
                true,
                "Ticket message type is required",
            ],
            enum: {
                values: TICKET_MESSAGE_TYPE_VALUES,
                message:
                    "Ticket message type must be public_reply or internal_note",
            },
            immutable: true,
        },

        body: {
            type: String,
            required: [
                true,
                "Ticket message body is required",
            ],
            trim: true,
            minlength: [
                TICKET_MESSAGE_LIMITS.BODY_MIN_LENGTH,
                "Ticket message body cannot be empty",
            ],
            maxlength: [
                TICKET_MESSAGE_LIMITS.BODY_MAX_LENGTH,
                `Ticket message body cannot exceed ${TICKET_MESSAGE_LIMITS.BODY_MAX_LENGTH} characters`,
            ],
        },

        authorUser: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: [
                true,
                "Ticket message author is required",
            ],
            immutable: true,
        },

        editedAt: {
            type: Date,
            default: null,
        },

        editedBy: {
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

ticketMessageSchema.virtual("visibility").get(
    function getMessageVisibility() {
        return this.type ===
            TICKET_MESSAGE_TYPES.INTERNAL_NOTE
            ? "internal"
            : "customer";
    }
);

ticketMessageSchema.virtual("isInternal").get(
    function getIsInternal() {
        return (
            this.type ===
            TICKET_MESSAGE_TYPES.INTERNAL_NOTE
        );
    }
);

ticketMessageSchema.pre(
    "validate",
    function validateEditingMetadata() {
        const hasEditedAt =
            this.editedAt !== null &&
            this.editedAt !== undefined;

        const hasEditedBy =
            this.editedBy !== null &&
            this.editedBy !== undefined;

        if (hasEditedAt && !hasEditedBy) {
            this.invalidate(
                "editedBy",
                "editedBy is required when editedAt is provided"
            );
        }

        if (hasEditedBy && !hasEditedAt) {
            this.invalidate(
                "editedAt",
                "editedAt is required when editedBy is provided"
            );
        }
    }
);

ticketMessageSchema.index(
    {
        workspace: 1,
        ticket: 1,
        createdAt: 1,
        _id: 1,
    },
    {
        name: "ticket_message_timeline",
    }
);

ticketMessageSchema.index(
    {
        workspace: 1,
        authorUser: 1,
        createdAt: -1,
    },
    {
        name: "ticket_message_author_history",
    }
);

const TicketMessage = mongoose.model(
    "TicketMessage",
    ticketMessageSchema
);

export default TicketMessage;