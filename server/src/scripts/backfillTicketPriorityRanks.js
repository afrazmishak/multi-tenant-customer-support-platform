import "dotenv/config";
import mongoose from "mongoose";

import Ticket from "../models/Ticket.js";

import {
    TICKET_PRIORITY_RANKS,
} from "../constants/ticket.constants.js";

const APPLY_MIGRATION =
    process.argv.includes("--apply");

async function backfillTicketPriorityRanks() {
    if (!process.env.MONGODB_URI) {
        throw new Error(
            "MONGODB_URI is missing from the environment"
        );
    }

    await mongoose.connection(
        process.env.MONGODB_URI
    );

    console.log("Connected to MongoDB.");
    console.log(
        APPLY_MIGRATION
            ? "Mode: APPLY"
            : "Mode: DRY RUN"
    );

    const totalTickets =
        await Ticket.countDocuments();

    console.log(`Ticket tickets: ${totalTickets}`);

    // Aggregate existing priority/rank combinations
    const groups = await Ticket.aggregate([
        {
            $group: {
                _id: {
                    priority: "$priority",
                    priorityRank: "$priorityRank",
                },
                count: { $sum: 1 },
            },
        },
    ]);

    let needsUpdate = 0;

    for (const group of groups) {
        const priority = group._id.priority;
        const expectedRank =
            TICKET_PRIORITY_RANKS[priority];

        if (expectedRank === undefined) {
            throw new Error(
                `Unexpected ticket priority: ${priority}`
            );
        }

        const actualRank =
            group._id.priorityRank ?? null;

        if (actualRank !== expectedRank) {
            needsUpdate += group.count;

            console.log(
                `${priority}: ${group.count} ticket(s) ` +
                `with rank ${actualRank}; expected ${expectedRank}`
            );
        }
    }

    console.log(
        `Ticket requiring correction: ${needsUpdate}`
    );

    if (!APPLY_MIGRATION) {
        console.log(
            "Dry run complete. No records modified."
        );
        return;
    }

    let modifiedTickets = 0;

    for (const [priority, rank] of
        Object.entries(TICKET_PRIORITY_RANKS)) {

        const result =
            await Ticket.collection.updateMany(
                {
                    priority,
                    priorityRank: { $ne: rank },
                },
                {
                    $set: {
                        priorityRank: rank,
                    },
                }
            );

        modifiedTickets += result.modifiedCount;
    }

    console.log(
        `Tickets modified: ${modifiedTickets}`
    );

    // Verify all stored priorities and ranks.
    const remaining = await Ticket.aggregate([
        {
            $group: {
                _id: {
                    priority: "$priority",
                    priorityRank: "$priorityRank",
                },
                count: { $sum: 1 },
            },
        },
    ]);

    const invalidGroups = remaining.filter(
        (group) =>
            TICKET_PRIORITY_RANKS[
            group._id.priority
            ] !== group._id.priorityRank
    );

    if (invalidGroups.length > 0) {
        throw new Error(
            "Verification failed: some priority ranks are incorrect"
        );
    }

    console.log(
        "Migration verified successfully."
    )
}

try {
    await backfillTicketPriorityRanks();
} catch (error) {
    console.error(
        "Priority rank migration failed:",
        error
    );
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}