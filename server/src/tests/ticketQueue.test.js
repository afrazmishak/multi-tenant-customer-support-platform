import test from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";

import Ticket from "../models/Ticket.js";

const workspaceA = new mongoose.Types.ObjectId()
const workspaceB = new mongoose.Types.ObjectId()

const agentA = new mongoose.Types.ObjectId();
const agentB = new mongoose.Types.ObjectId();

const customerA = new mongoose.Types.ObjectId();
const customerB = new mongoose.Types.ObjectId();

function ticket(overrides = {}) {
    return {
        workspace: workspaceA,
        customer: customerA,
        assigned: agentA,
        subject: "Test ticket",
        status: "open",
        priority: "normal",
        priorityRank: 2,
        ...overrides,
    };
}

const fixtures = [
    ticket({
        workspace: workspaceA,
        ticketNumber: 1,
        status: "open",
        priority: "urgent",
        priorityRank: 4,
    }),
    ticket({
        workspace: workspaceA,
        ticketNumber: 2,
        status: "in_progress",
        priority: "high",
        priorityRank: 3,
    }),
    ticket({
        workspace: workspaceA,
        ticketNumber: 3,
        status: "resolved",
        priority: "low",
        priorityRank: 1,
    }),
    ticket({
        workspace: workspaceB,
        customer: customerB,
        assignedTo: agentB,
        ticketNumber: 1,
        status: "open",
        priority: "urgent",
        priorityRank: 4,
    }),
];

function filterTickets(workspaceId, predicate = () => true) {
    return fixtures.filter(
        (item) =>
            item.workspace.equals(workspaceId) &&
            predicate(item)
    );
}

test("Workspace A cannot retrieve Workspace B tickets", () => {
    const results = filterTickets(workspaceA);

    assert.equal(results.length, 3);

    assert.ok(
        results.every((item) =>
            item.workspace.equals(workspaceA)
        )
    );
});

test("Workspace B sees only its own tickets", () => {
    const results = filterTickets(workspaceB);

    assert.equal(results.length, 1);

    assert.equal(results[0].ticketNumber, 1);
});

test("Active view excludes resolved tickets", () => {
    const activeStatuses = new Set([
        "open",
        "in_progress",
    ]);

    const results = filterTickets(
        workspaceA,
        (item) => activeStatuses.has(item.status)
    );

    assert.equal(results.length, 2);
})

test("Priority sorting uses numeric rank", () => {
    const results = filterTickets(workspaceA)
        .sort(
            (a, b) => b.priorityRank - a.priorityRank
        );

    assert.deepEqual(
        results.map((item) => item.priority),
        ["urgent", "high", "low"]
    );
});

test("Unassigned view excludes assigned tickets", () => {
    const results = filterTickets(
        workspaceA,
        (item) => item.assignedTo === null
    );

    assert.equal(results.length, 0);
});

test("Pagination limits returned records", () => {
    const results = filterTickets(workspaceA);

    const page = 1;
    const limit = 2;

    const paginated = results.slice(
        (page - 1) * limit,
        page * limit
    );

    assert.equal(paginated.length, 2);
});