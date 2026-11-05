import "dotenv/config";

import {
    test,
    before,
    after,
} from "node:test";

import assert from "node:assert/strict";
import mongoose from "mongoose";

import Ticket from "../models/Ticket.js";

import {
    listTickets,
    getTicketById,
} from "../services/ticket.service.js";

const DATABASE_NAME = "customer_support_benchmark";
const RUN_ID = "phase39-ticket-queue-v1";

let workspaceA;
let workspaceB;
let actorUserId;
let existingTicketId;

before(async () => {
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

    const sample = await Ticket.collection.findOne({
        benchmarkRun: RUN_ID,
    });

    if (!sample) {
        throw new Error(
            "Benchmark tickets not found"
        );
    }

    workspaceA = sample.workspace;
    existingTicketId = sample._id;

    //Synthetic workspace with no benchmark tickets
    workspaceB = new mongoose.Types.ObjectId();

    actorUserId = new mongoose.Types.ObjectId();

    const total = await Ticket.collection.countDocuments();

    const benchmarkCount =
        await Ticket.collection.countDocuments({
            benchmarkRun: RUN_ID,
        });

    assert.equal(total, 10_000);
    assert.equal(benchmarkCount, 10_000);

    console.log(
        "\nConnected to isolated benchmark database"
    );
});

after(async () => {
    await mongoose.disconnect();
});

//Test 1 - List all tickets in Workspace A
test("Lists tickets from the authorized workspace ID", async () => {
    const result = await listTickets({
        workspaceId: workspaceA,
        actorUserId,
        query: {
            view: "all",
            page: "1",
            limit: "25",
        },
    });

    assert.equal(result.tickets.length, 25);
    assert.equal(result.pagination.totalTickets, 10_000);

    for (const ticket of result.tickets) {
        assert.equal(
            ticket.workspace.toString(),
            workspaceA.toString()
        );
    }
});

// Test 2 - Active queue
test("Active view excludes non-active statuses", async () => {
    const result = await listTickets({
        workspaceId: workspaceA,
        actorUserId,
        query: {
            view: "active",
            page: "1",
            limit: "25",
        },
    });

    const allowed = new Set([
        "open",
        "in_progress",
    ]);

    assert.equal(result.tickets.length, 25);
    assert.equal(result.pagination.totalTickets, 2000);

    for (const ticket of result.tickets) {
        assert.ok(allowed.has(ticket.status));
    }
});

//Test 3 - Priority sorting
test("Sorts tickets by numeric business priority", async () => {
    const result = await listTickets({
        workspaceId: workspaceA,
        actorUserId,
        query: {
            view: "all",
            sort: "priority_desc",
            limit: "100",
        },
    });

    const ranks = {
        low: 1,
        normal: 2,
        high: 3,
        urgent: 4,
    };

    for (let i = 0; i < result.tickets.length; i++) {
        const current = result.tickets[i];

        assert.equal(
            current.priorityRank,
            ranks[current.priority]
        );

        if (i > 0) {
            assert.ok(
                result.tickets[i - 1].priorityRank >=
                current.priorityRank
            );
        }
    }
});

//Test 4 - pagination
test("Pagination returns the correct page size", async () => {
    const result = await listTickets({
        workspaceId: workspaceA,
        actorUserId,
        query: {
            view: "all",
            page: "2",
            limit: "10",
        },
    })

    assert.equal(result.tickets.length, 10);
    assert.equal(result.pagination.page, 2);
    assert.equal(result.pagination.limit, 10);
    assert.equal(result.pagination.totalPages, 1000);
    assert.equal(result.pagination.hasPreviousPage, true);
    assert.equal(result.pagination.hasNextPage, true);
});

//Test 5 - Workspace isolation
test("Another workspace cannot list workspace A tickets", async () => {
    const result = await listTickets({
        workspaceId: workspaceB,
        actorUserId,
        query: {
            view: "all",
        },
    });

    assert.ok(
        Array.isArray(result.tickets),
        "Expected tickets to be an array"
    );

    assert.equal(result.tickets.length, 0);

    assert.equal(
        result.pagination.totalTickets,
        0
    );

    assert.equal(
        result.pagination.totalPages,
        0
    );
});

//Test 6 - Cross workspace ticket access
test("Cross-workspace ticket lookup is rejected", async () => {
    await assert.rejects(
        () =>
            getTicketById({
                workspaceId: workspaceB,
                ticketId: existingTicketId,
            }),
        (error) => {
            assert.equal(error.statusCode, 404);
            return true;
        }
    );
});

//Test 7 - Invalid pagination
test("Rejects invalid page numbers", async () => {
    await assert.rejects(
        () =>
            listTickets({
                workspaceId: workspaceA,
                actorUserId,
                query: {
                    view: "all",
                    page: "-1",
                },
            }),
        (error) => {
            assert.equal(error.statusCode, 400);
            return true;
        }
    );
});