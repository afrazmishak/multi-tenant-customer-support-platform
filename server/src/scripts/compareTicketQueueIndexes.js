import "dotenv/config";
import mongoose from "mongoose";

import Ticket from "../models/Ticket.js";
import { stat } from "node:fs";

const DATABASE_NAME = "customer_support_benchmark";
const RUN_ID = "phase39-ticket-queue-v1";

const INDEXES = {
    priority: "ticket_workspace_priority_queue",
    statusPriority: "ticket_workspace_status_priority_queue",
    activity: "ticket_workspace_activity_queue",
};

async function runComparison(
    collection,
    label,
    filter,
    sort,
    indexNames
) {
    console.log(`\n${label}`);

    for (const indexName of indexNames) {
        try {
            const result = await collection
                .find(filter)
                .sort(sort)
                .limit(25)
                .hint(indexName)
                .explain("executionStats");

            const stats = result.executionStats;

            console.log({
                index: indexName,
                returned: stats.nReturned,
                documentsExamined: stats.totalDocsExamined,
                keysExamined: stats.totalKeysExamined,
                executionTimeMs: stats.executionTimeMillis,
            });
        } catch (error) {
            console.log({
                index: indexName,
                error: error.message,
            });
        }
    }
}

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

    if (mongoose.connection.name !== DATABASE_NAME) {
        throw new Error(
            `Wrong database: ${mongoose.connection.name}`
        );
    }

    const collection = Ticket.collection;

    const sample = await collection.findOne({
        benchmarkRun: RUN_ID,
    });

    if (!sample) {
        throw new Error(
            "Benchmark dataset was not found"
        );
    }

    const workspace = sample.workspace;

    const total = await collection.countDocuments({
        workspace,
        benchmarkRun: RUN_ID,
    });

    if (total !== 10_000) {
        throw new Error(
            `Expected 10000 benchmark tickets, found ${total}`
        );
    }

    const activeFilter = {
        workspace,
        benchmarkRun: RUN_ID,
        status: {
            $in: ["open", "in_progress"],
        },
    };

    await runComparison(
        collection,
        "Active tickets - priority descending",
        activeFilter,
        {
            priorityRank: -1,
            updatedAt: -1,
            _id: -1,
        },
        [
            INDEXES.priority,
            INDEXES.statusPriority,
        ]
    );

    const staleCutoff = new Date(
        Date.now() - 48 * 60 * 60 * 1000
    );

    const staleFilter = {
        workspace,
        benchmarkRun: RUN_ID,

        status: {
            $in: [
                "open",
                "in_progress",
                "waiting_on_customer",
            ],
        },

        lastActivityAt: {
            $lte: staleCutoff,
        },
    };

    await runComparison(
        collection,
        "Stale tickets - activity descending",
        staleFilter,
        {
            lastActivityAt: -1,
            _id: -1
        },
        [
            INDEXES.priority,
            INDEXES.activity,
        ]
    );
}

try {
    await main();
} catch (error) {
    console.error("Comparison failed:", error);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}