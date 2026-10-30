import "dotenv/config"
import mongoose, { mongo } from "mongoose"

import Ticket from "../models/Ticket.js"

const workspaceId = process.argv[2];

if (
    !workspaceId ||
    !mongoose.isValidObjectId(workspaceId)
) {
    console.error(
        "Usage: node src/scripts/analyzeTicketQueuePerformace.js <workspaceId>"
    );
    process.exit(1);
}

async function analyzeQuery(name, filter, sort) {
    const query = Ticket.find(filter)
        .sort(sort)
        .limit(25)
        .lean()

    const explanation =
        await query.explain("executionStats");

    const stats = explanation.executionStats;

    const plan = explanation.queryPlanner?.winningPlan;

    console.log(`\n--- ${name} ---`);

    console.log({
        returned: stats.nReturned,
        documentsExamined: stats.totalDocsExamined,
        keysExamined: stats.totalKeysExamined,
        executionTimsMs: stats.executionTimsMillis,
    });

    console.log(
        "Winning plan:",
        JSON.stringify(plan, null, 2)
    );
}

async function main() {
    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is required");
    }

    await mongoose.connect(
        process.env.MONGODB_URI
    );

    console.log(
        `Connected to database: ${mongoose.connection.name}`
    );

    const workspace =
        new mongoose.Types.ObjectId(workspaceId);

    const staleCutoff = new Date(
        Date.now() - 48 * 60 * 60 * 1000
    );

    await analyzeQuery(
        "All tickets by priority",
        {
            workspace,
        },
        {
            priorityRank: -1,
            updatedAt: -1,
            _id: -1,
        }
    );

    await analyzeQuery(
        "Active tickets by priority",
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

    await analyzeQuery(
        "Stale tickets by activity",
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
                $lte: staleCutoff,
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
    console.error(
        "Query analysis failed:",
        error
    ); process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}