import "dotenv/config";
import mongoose from "mongoose";

import Ticket from "../models/Ticket.js";

const DATABASE_NAME = "customer_support_benchmark";
const RUN_ID = "phase39-ticket-queue-v1";

async function main() {
    const uri = process.env.BENCHMARK_MONGODB_URI;

    if (!uri) {
        throw new Error(
            "BENCHMARK_MONGODB_URI is required"
        );
    }

    await mongoose.connect(uri, {
        autoIndex: false,
    });

    const dbName = mongoose.connection.name;

    if (dbName !== DATABASE_NAME) {
        throw new Error(
            `Refusing to modify database: ${dbName}`
        );
    }

    const collection = Ticket.collection;

    const total = await collection.countDocuments({});

    const benchmarkCount = await collection.countDocuments({
        benchmarkRun: RUN_ID,
    });

    const otherCount = await collection.countDocuments({
        benchmarkRun: { $ne: RUN_ID },
    });

    const sample = await collection.findOne(
        {},
        {
            projection: {
                benchmarkRun: 1,
                workspace: 1,
                ticketNumber: 1,
            },
        }
    );

    console.log("Database:", mongoose.connection.name);
    console.log("Collection:", collection.collectionName);
    console.log("RUN_ID:", JSON.stringify(RUN_ID));

    console.log({
        total,
        benchmarkCount,
        otherCount,
        sample,
    });

    if (
        total !== 10_000 ||
        benchmarkCount !== 10_000 ||
        otherCount !== 0
    ) {
        throw new Error(
            "Benchmark dataset mismatch. Aborting index creation."
        );
    }

    console.log("Sample benchmark document:", sample);

    console.log(
        `Verified database: ${dbName}`
    );

    console.log(
        `Verified benchmark tickets: ${benchmarkCount}`
    );

    //Candidate 1: Status + priority
    const statusPriorityIndex =
        await collection.createIndex(
            {
                workspace: 1,
                status: 1,
                priorityRank: -1,
                updatedAt: -1,
                _id: -1,
            },
            {
                name:
                    "ticket_workspace_status_priority_queue",
            }
        );

    console.log(
        "Created/verified:",
        statusPriorityIndex
    );

    // Candidate 2: Last activity
    const activityIndex =
        await collection.createIndex(
            {
                workspace: 1,
                lastActivityAt: -1,
                _id: -1,
            },
            {
                name:
                    "ticket_workspace_activity_queue",
            }
        );

    console.log(
        "Created/verified:",
        activityIndex
    );

    console.log(
        "\nCandidate index creation completed."
    );
}

try {
    await main();
} catch (error) {
    console.error(
        "Index creation failed:",
        error
    );

    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}