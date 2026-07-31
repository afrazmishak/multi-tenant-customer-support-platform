import mongoose from "mongoose";

const { Schema } = mongoose;

const ticketCounterSchema = new Schema(
    {
        workspace: {
            type: Schema.Types.ObjectId,
            ref: "Workspace",
            required: [
                true,
                "Ticket counter workspace is required",
            ],
            immutable: true,
        },

        value: {
            type: Number,
            default: 0,
            min: [
                0,
                "Ticket counter cannot be negative",
            ],
            validate: {
                validator(value) {
                    return Number.isSafeInteger(value);
                },
                message:
                    "Ticket counter must be a safe integer",
            },
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

ticketCounterSchema.index(
    {
        workspace: 1,
    },
    {
        unique: true,
        name: "unique_ticket_counter_per_workspace",
    }
);

const TicketCounter =
    mongoose.models.TicketCounter ||
    mongoose.model(
        "TicketCounter",
        ticketCounterSchema
    );

export default TicketCounter;