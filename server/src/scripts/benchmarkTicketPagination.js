import "dotenv/config";
import mongoose from "mongoose";
import Ticket from "../models/Ticket.js"
import { stat } from "node:fs";

const DATABASE_NAME = "customer_support_benchmark";
const RUN_ID = "phase39-ticket-queue-v1";

const LIMIT = 25;
const DEEP_PAGE = 70;

const SORT = {
    pirorityRank: -1,
    updatedAt: -1,
    _id: -1,
};

function collectStages(node, stages = []) {
    if (!node || typeof node !== "object") {
        return stages;
    }

    if (Array.isArray(node)) {
        for (const item of node) {
            collectStages(item, stages);
        }
        return stages;
    }

    if (node.stage) {
        stages.push({
            stage: node.stage,
            index: node.indexName ?? null,
        });
    }

    for (const [key, value] of Object.entries(node)) {
        if (key !== "stage" && key !== "indexName") {
            collectStages(value, stages);
        }
    }

    return stages;
}

function printStats(label, explanation) {
    const stats = explanation.executionStats;

    console.log(`\n--- ${label} ---`);

    console.log({
        returned: stats.nReturned,
        documentsExamined: stats.totalDocsExamined,
        keysExamined: stats.totalKeysExamined,
        executionTimeMs: stats.executionTimeMillis,
        stages: collectStages(
            explanation.queryPlanner.winningPlan
        ),
    });
}

function buildCursorFilter(anchor) {
    return {
        $or: [
            {
                priorityRank: {
                    $lt: anchor.priorityRank,
                },
            },
            {
                priorityRank: anchor.priorityRank,
                updatedAt: {
                    $lt: anchor.updatedAt,
                },
            },
            {
                priorityRank: anchor.priorityRank,
                updatedAt: anchor.updatedAt,
                _id: {
                    $lt: anchor._id,
                },
            },
        ],
    };
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
            `Refusing database: ${mongoose.connection.name}`
        );
    }

    const collection = Ticket.collection;

    const sample = await collection.findOne({
        benchmarkRun: RUN_ID,
    });

    if (!sample) {
        throw new Error("Benchmark dataset not found");
    }

    const workspace = sample.workspace;

    const benchmarkCount = await collection.countDocuments({
        workspace,
        benchmarkRun: RUN_ID,
    });

    if (benchmarkCount !== 10_000) {
        throw new Error(
            `Expected 10000 benchmark tickets, found ${benchmarkCount}`
        );
    }

    const filter = {
        workspace,
        status: {
            $in: ["open", "in_progress"],
        },
    };

    const matchingCount =
        await collection.countDocuments(filter);

    const totalPages = Math.ceil(
        matchingCount / LIMIT
    );

    const targetPage = Math.min(
        DEEP_PAGE,
        totalPages
    );

    if (targetPage < 2) {
        throw new Error(
            "Not enough tickets for deep pagination testing"
        );
    }

    const skip = (DEEP_PAGE - 1) * LIMIT;

    if (matchingCount <= skip) {
        throw new Error(
            `Not enough active tickets for page ${DEEP_PAGE}. ` +
            `Found ${matchingCount}.`
        );
    }

    console.log("Database:", DATABASE_NAME);
    console.log("Workspace:", workspace.toString());
    console.log("Active tickets:", matchingCount);
    console.log("Page size:", LIMIT);

    //Test 1: First page using offset pagination
    const firstPage = await collection
        .find(filter)
        .sort(SORT)
        .skip(0)
        .limit(LIMIT)
        .hint("ticket_workspace_status_priority_queue")
        .explain("executionStats");

    printStats("Offset pagination - page 1", firstPage);

    console.log("\n--- Index selection comparison ---");

    const indexStrategies = [
        {
            name: "Automatic planner",
            hint: null,
        },
        {
            name: "Status-priority index",
            hint: "ticket_workspace_status_priority_queue",
        },
        {
            name: "Priority index",
            hint: "ticket_workspace_priority_queue"
        },
    ];

    for (const strategy of indexStrategies) {
        let query = collection
            .find(filter)
            .sort(SORT)
            .limit(LIMIT);

        if (strategy.hint) {
            query = query.hint(strategy.hint);
        }

        const explanation =
            await query.explain("executionStats");

        printStats(strategy.name, explanation);
    }

    //Test 2: Deep page using offset pagination
    const deepPage = await collection
        .find(filter)
        .sort(SORT)
        .skip(skip)
        .limit(LIMIT)
        .hint("ticket_workspace_status_priority_queue")
        .explain("executionStats");

    printStats(
        `Offset pagination - page ${targetPage}`,
        deepPage
    );

    const anchor = await collection
        .find(filter)
        .sort(SORT)
        .skip(skip - 1)
        .limit(1)
        .next();

    if (!anchor) {
        throw new Error("Cursor anchor not found");
    }

    //Test 3: Fetch records after that cursor.
    const cursorFilter = {
        $and: [
            filter,
            buildCursorFilter(anchor),
        ],
    };

    const cursorPage = await collection
        .find(cursorFilter)
        .sort(SORT)
        .limit(LIMIT)
        .explain("executionStats");

    printStats(
        `Cursor pagination - equivalent to page ${targetPage}`,
        cursorPage
    );

    //Verify that both strategies return the same IDs
    const offsetIds = await collection
        .find(filter, { projection: { _id: 1 } })
        .sort(SORT)
        .skip(skip)
        .limit(LIMIT)
        .toArray();

    const cursorIds = await collection
        .find(filter, { projection: { _id: 1 } })
        .sort(SORT)
        .skip(skip)
        .limit(LIMIT)
        .toArray();

    const offsetIdStrings = offsetIds.map(
        (ticket) => ticket._id.toString()
    );

    const cursorIdStrings = cursorIds.map(
        (ticket) => ticket._id.toString()
    );

    const identical =
        JSON.stringify(offsetIdStrings) ===
        JSON.stringify(cursorIdStrings);

    console.log("\nPagination correctness:");
    console.log("Same tickets and order:", identical);

    if (!identical) {
        throw new Error(
            "Cursor pagination does not match offset result"
        );
    }

    console.log("\nBenchmark completed.");
}

try {
    await main();
} catch (error) {
    console.error(
        "\nPagination benchmark failed:",
        error
    );

    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}