
import "dotenv/config";
import mongoose from "mongoose";

import Ticket from "../models/Ticket.js";

const DATABASE_NAME = "customer_support_benchmark";
const RUN_ID = "phase39-ticket-queue-v1";

const PAGE_SIZE = 25;

// Extract relevant stages from MongoDB's query plan.
function collectStages(node, output = []) {
    if (!node || typeof node !== "object") {
        return output;
    }

    if (Array.isArray(node)) {
        for (const child of node) {
            collectStages(child, output);
        }
        return output;
    }

    if (typeof node.stage === "string") {
        output.push({
            stage: node.stage,
            index: node.indexName ?? null,
        });
    }

    for (const [key, value] of Object.entries(node)) {
        if (key !== "stage" && key !== "indexName") {
            collectStages(value, output);
        }
    }

    return output;
}

async function analyzeQuery(
    name,
    collection,
    filter,
    sort,
    skip = 0
) {
    const explanation = await collection
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(PAGE_SIZE)
        .explain("executionStats");

    const stats = explanation.executionStats;

    const stages = collectStages(
        explanation.queryPlanner?.winningPlan
    );

    const stageNames = [
        ...new Set(stages.map((item) => item.stage)),
    ];

    const indexes = [
        ...new Set(
            stages
                .map((item) => item.index)
                .filter(Boolean)
        ),
    ];

    const results = {
        query: name,
        returned: stats.nReturned,
        documentsExamined: stats.totalDocsExamined,
        keysExamined: stats.totalKeysExamined,
        executionTimeMs: stats.executionTimeMillis,
        examinedPerResult:
            stats.nReturned > 0
                ? Number(
                      (
                          stats.totalDocsExamined /
                          stats.nReturned
                      ).toFixed(2)
                  )
                : null,
        stages: stageNames,
        indexes,
    };

    console.log(
        "\n" + "=".repeat(55)
    );

    console.log(name);

    console.log(
        JSON.stringify(results, null, 2)
    );

    return results;
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

    // Find the dedicated synthetic workspace.
    const sample = await collection.findOne(
        { benchmarkRun: RUN_ID },
        { projection: { workspace: 1 } }
    );

    if (!sample?.workspace) {
        throw new Error(
            "No benchmark tickets found. Complete Step 12.1 first."
        );
    }

    const workspace = sample.workspace;

    const total = await collection.countDocuments({
        workspace,
        benchmarkRun: RUN_ID,
    });

    if (total < 10_000) {
        throw new Error(
            `Expected at least 10000 benchmark tickets, found ${total}`
        );
    }

    console.log("Database:", DATABASE_NAME);
    console.log("Workspace:", workspace.toString());
    console.log("Benchmark tickets:", total);

    // Always restrict queries to the synthetic workspace.
    const baseFilter = {
        workspace,
        benchmarkRun: RUN_ID,
    };

    const activeFilter = {
        ...baseFilter,
        status: {
            $in: ["open", "in_progress"],
        },
    };

    const prioritySort = {
        priorityRank: -1,
        updatedAt: -1,
        _id: -1,
    };

    const cutoff = new Date(
        Date.now() - 48 * 60 * 60 * 1000
    );

    // Test 1: All tickets by priority
    await analyzeQuery(
        "1. All tickets - priority descending",
        collection,
        baseFilter,
        prioritySort
    );

    // Test 2: Active ticket queue
    await analyzeQuery(
        "2. Active tickets - priority descending",
        collection,
        activeFilter,
        prioritySort
    );

    // Test 3: Stale ticket queue
    await analyzeQuery(
        "3. Stale tickets - activity descending",
        collection,
        {
            ...baseFilter,
            status: {
                $in: [
                    "open",
                    "in_progress",
                    "waiting_on_customer",
                ],
            },
            lastActivityAt: {
                $lte: cutoff,
            },
        },
        {
            lastActivityAt: -1,
            _id: -1,
        }
    );

    // Test 4: Offset pagination
    await analyzeQuery(
        "4. Active tickets - page 100",
        collection,
        activeFilter,
        prioritySort,
        (100 - 1) * PAGE_SIZE
    );

    // Test 5: Case-insensitive subject search
    await analyzeQuery(
        "5. Subject regex search",
        collection,
        {
            ...baseFilter,
            subject: /Benchmark support ticket 99/i,
        },
        prioritySort
    );

    console.log(
        "\nBenchmark analysis completed."
    );
}

try {
    await main();
} catch (error) {
    console.error(
        "\nBenchmark failed:",
        error.message
    );
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}
