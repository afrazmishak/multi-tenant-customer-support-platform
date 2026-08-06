import assert from "node:assert/strict";
import "dotenv/config";
import mongoose from "mongoose";

import TicketActivity
    from "../models/TicketActivity.js";

import {
    TICKET_ACTIVITY_ENTITY_TYPES,
    TICKET_ACTIVITY_TYPES,
} from "../constants/ticketActivity.constants.js";

import {
    buildTicketChanges,
    recordTicketActivity,
} from "../services/ticketActivity.service.js";

const workspaceId =
    new mongoose.Types.ObjectId();

const ticketId =
    new mongoose.Types.ObjectId();

const actorUserId =
    new mongoose.Types.ObjectId();

const agentUserId =
    new mongoose.Types.ObjectId();

const messageId =
    new mongoose.Types.ObjectId();

function printPassed(message) {
    console.log(`✓ ${message}`);
}

async function connectToDatabase() {
    const databaseUri =
        process.env.MONGODB_URI ??
        process.env.MONGO_URI;

    assert.ok(
        databaseUri,
        "MONGODB_URI or MONGO_URI is missing"
    );

    await mongoose.connect(
        databaseUri,
        {
            serverSelectionTimeoutMS:
                10_000,
        }
    );

    console.log(
        "MongoDB connected"
    );
}

async function cleanFixtures() {
    if (
        mongoose.connection.readyState !==
        1
    ) {
        return;
    }

    await TicketActivity.deleteMany({
        workspace:
            workspaceId,
    });
}

async function verifyService() {
    console.log(
        "\nVerifying TicketActivity service...\n"
    );

    await connectToDatabase();
    await cleanFixtures();

    console.log(
        "1. Testing ticket-created activity"
    );

    const createdActivity =
        await recordTicketActivity({
            workspaceId,
            ticketId,

            type:
                TICKET_ACTIVITY_TYPES.TICKET_CREATED,

            actorUserId,

            metadata: {
                ticketNumber:
                    1001,

                subject:
                    "Audit service test",
            },
        });

    assert.equal(
        createdActivity.type,
        "ticket_created"
    );

    assert.equal(
        createdActivity.ticket.toString(),
        ticketId.toString()
    );

    assert.equal(
        createdActivity.entityType,
        "ticket"
    );

    assert.equal(
        createdActivity.entityId.toString(),
        ticketId.toString()
    );

    printPassed(
        "Ticket-created activity was recorded"
    );

    console.log(
        "\n2. Testing change builder"
    );

    const before = {
        priority:
            "normal",

        category:
            "Billing",

        assignedTo:
            null,

        tags: [
            "billing",
        ],
    };

    const after = {
        priority:
            "urgent",

        category:
            "Billing",

        assignedTo:
            agentUserId,

        tags: [
            "billing",
            "vip",
        ],
    };

    const changes =
        buildTicketChanges(
            before,
            after,
            [
                "priority",
                "category",
                "assignedTo",
                "tags",
            ]
        );

    assert.equal(
        changes.length,
        3
    );

    assert.deepEqual(
        changes.map(
            (change) =>
                change.field
        ),
        [
            "priority",
            "assignedTo",
            "tags",
        ]
    );

    assert.equal(
        changes[0].from,
        "normal"
    );

    assert.equal(
        changes[0].to,
        "urgent"
    );

    assert.equal(
        changes[1].from,
        null
    );

    assert.equal(
        changes[1].to,
        agentUserId.toString()
    );

    printPassed(
        "Only actual field changes were generated"
    );

    console.log(
        "\n3. Testing ticket-update activity"
    );

    const updateActivity =
        await recordTicketActivity({
            workspaceId,
            ticketId,

            type:
                TICKET_ACTIVITY_TYPES.TICKET_UPDATED,

            actorUserId,
            changes,
        });

    assert.equal(
        updateActivity.changes.length,
        3
    );

    printPassed(
        "Ticket changes were recorded"
    );

    console.log(
        "\n4. Testing message activity"
    );

    const messageActivity =
        await recordTicketActivity({
            workspaceId,
            ticketId,

            type:
                TICKET_ACTIVITY_TYPES.PUBLIC_REPLY_ADDED,

            actorUserId,

            entityType:
                TICKET_ACTIVITY_ENTITY_TYPES.MESSAGE,

            entityId:
                messageId,

            metadata: {
                messageType:
                    "public_reply",
            },
        });

    assert.equal(
        messageActivity.entityType,
        "message"
    );

    assert.equal(
        messageActivity.entityId.toString(),
        messageId.toString()
    );

    printPassed(
        "Message activity was recorded"
    );

    console.log(
        "\n5. Testing chronological activity history"
    );

    const activities =
        await TicketActivity.find({
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

    assert.equal(
        activities.length,
        3
    );

    assert.deepEqual(
        activities.map(
            (activity) =>
                activity.type
        ),
        [
            "ticket_created",
            "ticket_updated",
            "public_reply_added",
        ]
    );

    printPassed(
        "Activity history is chronological"
    );

    console.log(
        "\n6. Testing workspace isolation"
    );

    const otherWorkspaceId =
        new mongoose.Types.ObjectId();

    const otherWorkspaceActivities =
        await TicketActivity.find({
            workspace:
                otherWorkspaceId,

            ticket:
                ticketId,
        }).lean();

    assert.equal(
        otherWorkspaceActivities.length,
        0
    );

    printPassed(
        "Activity history is workspace-scoped"
    );

    console.log(
        "\nTicketActivity service verification completed successfully."
    );
}

verifyService()
    .catch((error) => {
        console.error(
            "\nTicketActivity service verification failed:"
        );

        console.error(error);

        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await cleanFixtures();

            console.log(
                "\nTemporary activity-service fixtures cleaned up"
            );
        } catch (cleanupError) {
            console.error(
                "\nActivity-service fixture cleanup failed:"
            );

            console.error(
                cleanupError
            );

            process.exitCode = 1;
        } finally {
            await mongoose.disconnect();
        }
    });