import "dotenv/config";
import mongoose from "mongoose";
import Ticket from "../models/Ticket.js";

const DATABASE_NAME = "customer_support_benchmark";
const RUN_ID = "phase39-ticket-queue-v1";

function getStages(plan, results = []) {
    if (!plan || typeof plan !== "object") {
        return results;
    }

    if (Array.isArray(plan)) {
        for (const item of plan) {
            getStages(item, results);
        }

        return results;
    }

    if (plan.stage) {
        results.push({
            stage: plan.stage,
            index: plan.indexName ?? null,
        });
    }

    for (const [key, value] of Object.entries(plan)) {
        if (key !== "stage" && key !== "indexName") {
            getStages(value, results);
        }
    }

    return results;
}

async function analyze(label, filter, sort) {
    const result = await Ticket.collection
        .find(filter)
        .sort(sort)
        .limit(25)
        .explain("executionStats");

    console.log(`\n--- ${label} ---`);
    console.log({
        returned: result.executionStats.nReturned,
        documentsExamined: result.executionStats.totalDocsExamined,
        keysExamined: result.executionStats.totalKeysExamined,
        executionTimeMs: result.executionStats.executionTimeMillis,
        stages: getStages(
            result.queryPlanner.winningPlan
        ),
    });
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
        throw new Error("Wrong database");
    }

    const collection = Ticket.collection;

    const sample = await collection.findOne({
        benchmarkRun: RUN_ID,
    });

    if (!sample) {
        throw new Error("Benchmark records not found");
    }

    const workspace = sample.workspace;

    const count = await collection.countDocuments({
        workspace,
        benchmarkRun: RUN_ID,
    });

    if (count !== 10_000) {
        throw new Error(
            `Expected 10000 tickets; found ${count}`
        );
    }

    // Match application filters without benchmarkRun
    await analyze(
        "Active queue - automatic index",
        {
            workspace,
            status: {
                $in: ["open", "in_progress"],
            },
        },
        {
            priorityRank: -1,
            updatedAt: -1,
            _id: -1,
        }
    );

    const cutoff = new Date(
        Date.now() - 48 * 60 * 60 * 1000 
    );

    await analyze(
        "Stale queue - automatic index",
        {
            workspace,
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
}

try {
    await main();
} catch (error) {
    console.error("Planner verification failed:", error);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}