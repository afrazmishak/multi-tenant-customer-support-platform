import mongoose from "mongoose";

import {
    TICKET_ACTIVITY_ENTITY_TYPE_VALUES,
    TICKET_ACTIVITY_TYPES,
    TICKET_ACTIVITY_TYPE_VALUES,
} from "../constants/ticketActivity.constants.js";

const { Schema } = mongoose;

const ticketActivityChangeSchema =
    new Schema(
        {
            field: {
                type: String,
                required: [
                    true,
                    "Activity change field is required",
                ],
                trim: true,
            },

            from: {
                type: Schema.Types.Mixed,
                default: null,
            },

            to: {
                type: Schema.Types.Mixed,
                default: null,
            },
        },
        {
            _id: false,
        }
    );

const ticketActivitySchema =
    new Schema(
        {
            workspace: {
                type: Schema.Types.ObjectId,
                ref: "Workspace",
                required: [
                    true,
                    "Activity workspace is required",
                ],
                immutable: true,
            },

            ticket: {
                type: Schema.Types.ObjectId,
                ref: "Ticket",
                required: [
                    true,
                    "Activity ticket is required",
                ],
                immutable: true,
            },

            type: {
                type: String,
                required: [
                    true,
                    "Activity type is required",
                ],
                enum: {
                    values:
                        TICKET_ACTIVITY_TYPE_VALUES,

                    message:
                        "Invalid ticket activity type",
                },
                immutable: true,
            },

            actorUser: {
                type: Schema.Types.ObjectId,
                ref: "User",
                default: null,
                immutable: true,
            },

            entityType: {
                type: String,
                required: [
                    true,
                    "Activity entity type is required",
                ],
                enum: {
                    values:
                        TICKET_ACTIVITY_ENTITY_TYPE_VALUES,

                    message:
                        "Invalid activity entity type",
                },
                immutable: true,
            },

            entityId: {
                type: Schema.Types.ObjectId,
                default: null,
                immutable: true,
            },

            changes: {
                type: [
                    ticketActivityChangeSchema,
                ],
                default: [],
                immutable: true,
            },

            metadata: {
                type: Schema.Types.Mixed,
                default: {},
                immutable: true,
            },

            createdAt: {
                type: Date,
                default: Date.now,
                immutable: true,
            },
        },
        {
            versionKey: false,

            toJSON: {
                virtuals: true,
            },

            toObject: {
                virtuals: true,
            },
        }
    );

ticketActivitySchema.pre(
    "validate",
    function validateActivityIntegrity() {
        const isMessageActivity =
            this.entityType === "message";

        if (
            isMessageActivity &&
            !this.entityId
        ) {
            this.invalidate(
                "entityId",
                "Message activity requires an entityId"
            );
        }

        const messageActivityTypes =
            new Set([
                TICKET_ACTIVITY_TYPES.PUBLIC_REPLY_ADDED,
                TICKET_ACTIVITY_TYPES.INTERNAL_NOTE_ADDED,
                TICKET_ACTIVITY_TYPES.MESSAGE_EDITED,
            ]);

        if (
            messageActivityTypes.has(
                this.type
            ) &&
            this.entityType !== "message"
        ) {
            this.invalidate(
                "entityType",
                "Message activity must use entityType message"
            );
        }
    }
);

ticketActivitySchema.index(
    {
        workspace: 1,
        ticket: 1,
        createdAt: 1,
        _id: 1,
    },
    {
        name: "ticket_activity_timeline",
    }
);

ticketActivitySchema.index(
    {
        workspace: 1,
        actorUser: 1,
        createdAt: -1,
    },
    {
        name: "ticket_activity_actor_history",
    }
);

ticketActivitySchema.index(
    {
        workspace: 1,
        type: 1,
        createdAt: -1,
    },
    {
        name: "ticket_activity_type_history",
    }
);

const TicketActivity =
    mongoose.model(
        "TicketActivity",
        ticketActivitySchema
    );

export default TicketActivity;