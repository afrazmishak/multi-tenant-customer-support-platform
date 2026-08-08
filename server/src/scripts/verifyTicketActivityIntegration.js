import assert from "node:assert/strict";
import "dotenv/config";
import mongoose from "mongoose";

import Customer from "../models/Customer.js";
import Membership from "../models/Membership.js";
import Ticket from "../models/Ticket.js";
import TicketActivity from "../models/TicketActivity.js";
import TicketCounter from "../models/TicketCounter.js";

import {
    MEMBERSHIP_ROLES,
} from "../constants/membership.constants.js";

import {
    createTicket,
    updateTicket,
    assignTicket,
    changeTicketStatus,
} from "../services/ticket.service.js";

const workspaceId =
    new mongoose.Types.ObjectId();

const actorUserId =
    new mongoose.Types.ObjectId();

const agentUserId =
    new mongoose.Types.ObjectId();

let customer = null;

function printPassed(message) {
    console.log(`✓ ${message}`);
}

async function connectToDatabase() {
    const uri =
        process.env.MONGODB_URI ??
        process.env.MONGO_URI;

    assert.ok(
        uri,
        "MONGODB_URI or MONGO_URI is missing"
    );

    await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10_000,
    });

    await TicketActivity.createIndexes();

    console.log("MongoDB connected");
}

async function cleanFixtures() {
    if (
        mongoose.connection.readyState !== 1
    ) {
        return;
    }

    await TicketActivity.deleteMany({
        workspace: workspaceId,
    });

    await Ticket.deleteMany({
        workspace: workspaceId,
    });

    await TicketCounter.deleteMany({
        workspace: workspaceId,
    });

    await Customer.deleteMany({
        workspace: workspaceId,
    });

    await Membership.deleteMany({
        tenantId: workspaceId,
    });
}

async function createFixtures() {
    customer =
        await Customer.create({
            workspace:
                workspaceId,

            name:
                "Audit Integration Customer",

            email:
                `audit-${workspaceId}@example.com`,

            createdBy:
                actorUserId,

            updatedBy:
                actorUserId,
        });

    await Membership.collection.insertMany([
        {
            tenantId:
                workspaceId,

            userId:
                actorUserId,

            role:
                MEMBERSHIP_ROLES.OWNER,

            status:
                "active",

            createdAt:
                new Date(),

            updatedAt:
                new Date(),
        },
        {
            tenantId:
                workspaceId,

            userId:
                agentUserId,

            role:
                MEMBERSHIP_ROLES.AGENT,

            status:
                "active",

            createdAt:
                new Date(),

            updatedAt:
                new Date(),
        },
    ]);
}

async function getActivities(ticketId) {
    return TicketActivity.find({
        workspace:
            workspaceId,

        ticket:
            ticketId,
    })
        .sort({
            createdAt: 1,
            _id: 1,
        })
        .lean();
}

async function verifyIntegration() {
    console.log(
        "\nVerifying ticket activity integration...\n"
    );

    await connectToDatabase();
    await cleanFixtures();
    await createFixtures();

    console.log(
        "1. Testing ticket-created audit"
    );

    const ticket =
        await createTicket({
            workspaceId,
            actorUserId,

            input: {
                customerId:
                    customer._id.toString(),

                subject:
                    "Audit integration ticket",

                description:
                    "Ticket used to verify activity history.",

                priority:
                    "normal",

                source:
                    "internal",

                category:
                    "Testing",

                tags: [
                    "audit",
                ],
            },
        });

    let activities =
        await getActivities(
            ticket._id
        );

    assert.equal(
        activities.length,
        1
    );

    assert.equal(
        activities[0].type,
        "ticket_created"
    );

    printPassed(
        "Ticket creation generated an audit event"
    );

    console.log(
        "\n2. Testing update audit"
    );

    await updateTicket({
        workspaceId,

        ticketId:
            ticket._id,

        actorUserId,

        input: {
            priority:
                "urgent",

            category:
                "Escalation",
        },
    });

    activities =
        await getActivities(
            ticket._id
        );

    assert.equal(
        activities.at(-1).type,
        "ticket_updated"
    );

    const updateChanges =
        activities.at(-1).changes;

    assert.ok(
        updateChanges.some(
            (change) =>
                change.field ===
                    "priority" &&
                change.from ===
                    "normal" &&
                change.to ===
                    "urgent"
        )
    );

    printPassed(
        "Ticket update recorded before and after values"
    );

    console.log(
        "\n3. Testing assignment audit"
    );

    await assignTicket({
        workspaceId,

        ticketId:
            ticket._id,

        actorUserId,

        input: {
            assignedTo:
                agentUserId.toString(),
        },
    });

    activities =
        await getActivities(
            ticket._id
        );

    assert.equal(
        activities.at(-1).type,
        "assigned"
    );

    printPassed(
        "Assignment generated an audit event"
    );

    console.log(
        "\n4. Testing status-change audit"
    );

    await changeTicketStatus({
        workspaceId,

        ticketId:
            ticket._id,

        actorUserId:
            agentUserId,

        input: {
            status:
                "in_progress",
        },
    });

    activities =
        await getActivities(
            ticket._id
        );

    assert.equal(
        activities.at(-1).type,
        "status_changed"
    );

    assert.deepEqual(
        activities.at(-1)
            .changes[0],
        {
            field:
                "status",

            from:
                "open",

            to:
                "in_progress",
        }
    );

    printPassed(
        "Status transition generated an audit event"
    );

    console.log(
        "\n5. Testing resolution audit"
    );

    await changeTicketStatus({
        workspaceId,

        ticketId:
            ticket._id,

        actorUserId:
            agentUserId,

        input: {
            status:
                "resolved",

            resolutionSummary:
                "Audit integration issue resolved.",
        },
    });

    activities =
        await getActivities(
            ticket._id
        );

    assert.equal(
        activities.at(-1).type,
        "resolved"
    );

    assert.equal(
        activities.at(-1)
            .metadata
            .resolutionSummary,

        "Audit integration issue resolved."
    );

    printPassed(
        "Resolution generated a detailed audit event"
    );

    console.log(
        "\n6. Testing reopen audit"
    );

    await changeTicketStatus({
        workspaceId,

        ticketId:
            ticket._id,

        actorUserId:
            agentUserId,

        input: {
            status:
                "in_progress",
        },
    });

    activities =
        await getActivities(
            ticket._id
        );

    assert.equal(
        activities.at(-1).type,
        "reopened"
    );

    printPassed(
        "Reopening generated an audit event"
    );

    console.log(
        "\n7. Resolving ticket again"
    );

    await changeTicketStatus({
        workspaceId,

        ticketId:
            ticket._id,

        actorUserId:
            agentUserId,

        input: {
            status:
                "resolved",

            resolutionSummary:
                "Final audit test resolution.",
        },
    });

    console.log(
        "\n8. Testing closure audit"
    );

    await changeTicketStatus({
        workspaceId,

        ticketId:
            ticket._id,

        actorUserId,

        input: {
            status:
                "closed",
        },
    });

    activities =
        await getActivities(
            ticket._id
        );

    assert.equal(
        activities.at(-1).type,
        "closed"
    );

    printPassed(
        "Closing generated an audit event"
    );

    console.log(
        "\n9. Testing complete chronology"
    );

    assert.deepEqual(
        activities.map(
            (activity) =>
                activity.type
        ),
        [
            "ticket_created",
            "ticket_updated",
            "assigned",
            "status_changed",
            "resolved",
            "reopened",
            "resolved",
            "closed",
        ]
    );

    printPassed(
        "Complete ticket history is chronological"
    );

    console.log(
        "\nTicket activity integration verification completed successfully."
    );
}

verifyIntegration()
    .catch((error) => {
        console.error(
            "\nTicket activity integration verification failed:"
        );

        console.error(error);

        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await cleanFixtures();

            console.log(
                "\nTemporary audit integration fixtures cleaned up"
            );
        } catch (cleanupError) {
            console.error(
                "\nAudit integration cleanup failed:"
            );

            console.error(
                cleanupError
            );

            process.exitCode = 1;
        } finally {
            await mongoose.disconnect();
        }
    });