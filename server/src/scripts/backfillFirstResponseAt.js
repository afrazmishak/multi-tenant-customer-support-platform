import "dotenv/config";
import mongoose from "mongoose";

import Ticket from "../models/Ticket.js";
import TicketMessage from "../models/TicketMessage.js";

import {
    TICKET_MESSAGE_TYPES,
} from "../constants/ticketMessage.constants.js";

const APPLY_CHANGES =
    process.argv.includes("--apply");

const BULK_WRITE_SIZE = 500;

function createTicketKey(
    workspaceId,
    ticketId,
) {
    return (
        `${String(workspaceId)}:` +
        `${String(ticketId)}`
    );
}

function datesEqual(
    left,
    right,
) {
    if (
        left == null &&
        right == null
    ) {
        return true;
    }

    if (
        left == null ||
        right == null
    ) {
        return false;
    }

    const leftTime =
        new Date(left).getTime;

    const rightTime =
        new Date(right).getTime;

    if (
        Number.isNaN(leftTime) ||
        Number.isNaN(rightTime)
    ) {
        return false;
    }

    return leftTime === rightTime;
}

async function getEarliestPublicReplies() {
    return TicketMessage.aggregate([
        {
            $match: {
                type:
                    TICKET_MESSAGE_TYPES
                        .PUBLIC_REPLY,
            },
        },

        {
            $group: {
                _id: {
                    workspace:
                        "$workspace",

                    ticket:
                        "$ticket",
                },

                firstResponseAt: {
                    $min:
                        "$createdAt",
                },
            },
        },
    ]).option({
        allowDiskUse: true,
    });
}

async function backfillFirstResponseAt() {
    if (!process.env.MONGODB_URI) {
        throw new Error(
            "MONGO_URI is required"
        );
    }

    console.log(
        APPLY_CHANGES
            ? "\nFIRST RESPONSE BACKFILL - APPLY MODE\n"
            : "\nFIRST RESPONSE BACKFILL - DRY RUN\n"
    );

    await mongoose.connect(
        process.env.MONGODB_URI
    );

    console.log(
        `Connected to MongoDB databaseL ${mongoose.connection.name}`
    );

    //STEP 1: RECONSTRUCT THE TRUE HISTORICAL FIRST PUBLIC REPLY FOR EVERY TICKET

    const earliestPublicReplies =
        await getEarliestPublicReplies();

    const firstResponseMap =
        new Map();

    for (
        const result
        of earliestPublicReplies
    ) {
        const key =
            createTicketKey(
                result._id.workspace,
                result._id.ticket
            );

        firstResponseMap.set(
            key,
            result.firstResponseAt
        );
    }

    //STEP 2: LOAD THE TICKETS THAT MAY NEED CORRECTIONS
    const tickets =
        await Ticket.find({})
            .select(
                "_id workspace ticketNumber firstResponseAt"
            )
            .lean();

    const operations = [];
    const preview = [];

    let unchangedTickets = 0;
    let ticketsWithResponses = 0;
    let ticketsWithoutResponses = 0;

    for (const ticket of tickets) {
        const key =
            createTicketKey(
                ticket.workspace,
                ticket._id
            );

        const historialFirstResponse =
            firstResponseMap.get(key) ??
            null;

        if (historialFirstResponse) {
            ticketsWithResponses += 1;
        } else {
            ticketsWithoutResponses += 1;
        }

        if (
            datesEqual(
                ticket.firstResponseAt,
                historialFirstResponse
            )
        ) {
            unchangedTickets += 1;
            continue;
        }

        operations.push({
            updateOne: {
                filter: {
                    _id: ticket._id,
                    workspace:
                        ticket.workspace,
                },

                update: {
                    $set: {
                        firstResponseAt:
                            historicalFirstResponse,
                    },
                },
            },
        });

        if (preview.length < 20) {
            preview.push({
                ticketNumber:
                    ticket.ticketNumber,

                ticketId:
                    String(ticket._id),

                currentFirstResponseAt:
                    ticket.firstResponseAt ??
                    null,

                historicalFirstResponseAt:
                    historicalFirstResponse,
            });
        }
    }

    console.log(
        "\nMigration analysis"
    );

    console.log(
        "------------------"
    );

    console.log(
        `Ticket scanned: ${tickets.length}`
    );

    console.log(
        `Ticket with public replies: ${ticketsWithResponses}`
    );

    console.log(
        `Tickets without public replies: ${ticketsWithoutResponses}`
    );

    console.log(
        `Already correct: ${unchangedTickets}`
    );

    console.log(
        `Need correction: ${operations.length}`
    );

    if (preview.length > 0) {
        console.log(
            "\nPreview of corrections:"
        );

        console.table(preview);
    }

    if (!APPLY_CHANGES) {
        console.log(
            "\nDRY RUN ONLY."
        );

        console.log(
            "No database records were changed."
        );

        console.log(
            "\nRun again with --apply to perform the migration."
        );

        return;
    }

    if (operations.length === 0) {
        console.log(
            "\nNothing needs to be changed."
        );

        return;
    }

    /*
     * Step 3:
     * Apply changes in batches.
     *
     * Using Ticket.collection directly
     * intentionally avoids changing
     * updatedAt during a historical
     * data migration.
     */
    let modifiedTickets = 0;

    for (
        let index = 0;
        index < operations.length;
        index += BULK_WRITE_SIZE
    ) {
        const batch =
            operations.slice(
                index,
                index +
                BULK_WRITE_SIZE
            );

        const result =
            await Ticket.collection
                .bulkWrite(
                    batch,
                    {
                        ordered: false,
                    }
                );

        modifiedTickets +=
            result.modifiedCount ?? 0;
    }

    console.log(
        "\nMigration complete."
    );

    console.log(
        `Tickets modified: ${modifiedTickets}`
    );
}


async function main() {
    try {
        await backfillFirstResponseAt();
    } catch (error) {
        console.error(
            "\nFirst-response backfill failed:"
        );

        console.error(error);

        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();

        console.log(
            "\nMongoDB disconnected."
        );
    }
}

await main();