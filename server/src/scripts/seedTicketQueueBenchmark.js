import "dotenv/config";
import mongoose, { mongo } from "mongoose";

import Ticket from "../models/Ticket.js";

import {
    TICKET_PRIORITY_RANKS,
} from "../constants/ticket.constants.js";

const DATABASE_NAME = "customer_support_benchmark";
const TARGET_COUNT = 10_000;
const BATCH_SIZE = 500;

const RUN_ID = "phase39-ticket-queue-v1";

const STATUSES = [
    "open",
    "im_progress",
    "waiting_on_customer",
    "resolved",
    "closed",
];

const PRIORITY = [
    "low",
    "normal",
    "high",
    "urgent"
];

const CATEGORIES = [
    "billing",
    "technical",
    "account",
    "general",
];

const workspaceId = 
    new mongoose.Types.ObjectId();

const customerId =
    new mongoose.Types.ObjectId();

const agentId =
    new mongoose.Types.ObjectId();

function createBenchmarkTicket(number) {
    const priority =
        PRIORITIES[number % PRIORITY.length];

    const status = 
        STATUSES[number % STATUSES.length];

    const createdAt = new Date(
        Date.now() -
        (number % 90) * 24 * 60 * 60 * 1000
    );

    const assigned =
        number % 3 !== 0;

    const isResolved = 
        status === "resolved" ||
        status === "closed";

    const isClosed = 
        status === "closed";

    return {
        benchmarkRun: RUN_ID,
        workspace: workspaceId,
        ticketNumber: number,

        customer: customerId,

        subject: `Benchmark support ticket ${number}`,

        description: 
            "Synthetic customer support request" +
            "used for queue performance testing.",

        status,
        priority,

        priorityRank: TICKET_PRIORITY_RANKS[priority],

        source: "web",

        category: CATEGORIES[number % CATEGORIES.length],

        tags: ["benchmark"],

        assignedTo: assigned ? agentId : null,

        assignedAt: assigned ? createdAt : null,

        assignedBy: assigned ? agentId : null,

        createdBy: agentId,
        updatedBy: agentId,

        firstResponseAt: null,

        lastActivityAt: createdAt,

        resolvedAt: isResolved ? createdAt : null,

        resolvedBy: isResolved ? agentId : null,

        resolutionSummary: isResolved ? "Benchmark resolution" : null,

        closedAt: isClosed ? createdAt : null,

        closedBy: isClosedc ? agentId : null,

        createdAt,
        updatedAt: createdAt,
    };
}

async function main() {
    const uri =
        process.env.BENCHMARK_MONGODB_URI;

    if (!uri) {
        throw new Error(
            "BENCHMARK_MONGODB_URI is required"
        );
    }

    await mongoose.connection(uri, {
        autoIndex: false,
    });

    if (mongoose.connection.name !== DATABASE_NAME) {
        throw new Error(
            `Refusing to run on database: ${mongoose.connection.name}`
        );
    }

    console.log(
        `Connected to benchmark database: ${DATABASE_NAME}`
    );

    const existing = 
        await Ticket.collection.countDocuments();

    if (existing !== 0) {
        throw new Error(
            "Benchmark tickets collection is not empty. " +
            "Use a fresh benchmark database."
        );
    }

    //Ensure benchmark indexes match the Ticket schema.
    await Ticket.createIndexes();

    let inserted = 0;

    for (
        let start = 1;
        start <= TARGET_COUNT;
        start += BATCH_SIZE
    ) {
        const end = Math.min(
            start + BATCH_SIZE - 1,
            TARGET_COUNT
        );

        const batch = [];

        for (
            let number = start;
            number <= end;
            number++
        ) {
            batch.push(
                createBenchmarkTicket(number)
            );
        }

        //Raw inserts intentionally avoid creating
        //customer, membership, and activity records.
        //This database is only for query benchmarks.
        await Ticket.collection.insertMany(
            batch,
            { ordered: true }
        );

        inserted += batch.length;

        console.log(
            `Inserted ${inserted}/${TARGET_COUNT}`
        );
    }

    const verified = 
        await Ticket.collection.countDocuments({
            benchmarkRun: RUN_ID,
        });

    if (verified !== TARGET_COUNT) {
        throw new Error(
            `Verification failed: found ${verified} tickets`
        );
    }

    console.log("\nBenchmark data created");
    console.log(`Tickets: ${verified}`);
    console.log(`Workspace ID: ${workspaceId.toString()}`);
    console.log(`Run ID: ${RUN_ID}`);
}

try {
    await main();
} catch (error) {
    console.error(
        "Benchmark seeding failed:",
        error
    );

    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}