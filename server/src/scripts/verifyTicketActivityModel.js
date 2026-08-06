import assert from "node:assert/strict";
import "dotenv/config";
import mongoose from "mongoose";

import TicketActivity
    from "../models/TicketActivity.js";

import {
    TICKET_ACTIVITY_ENTITY_TYPES,
    TICKET_ACTIVITY_TYPES,
} from "../constants/ticketActivity.constants.js";

const workspaceId =
    new mongoose.Types.ObjectId();

const ticketId =
    new mongoose.Types.ObjectId();

const actorUserId =
    new mongoose.Types.ObjectId();

const messageId =
    new mongoose.Types.ObjectId();

function printPassed(message) {
    console.log(`✓ ${message}`);
}

async function expectValidationFailure({
    document,
    expectedPath,
}) {
    let receivedError = null;

    try {
        await document.validate();
    } catch (error) {
        receivedError = error;
    }

    assert.ok(
        receivedError,
        "Expected validation to fail"
    );

    assert.ok(
        receivedError.errors?.[
        expectedPath
        ],
        `Expected validation error for ${expectedPath}`
    );
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
        workspace: workspaceId,
    });
}

async function verifyTicketActivityModel() {
    console.log(
        "\nVerifying TicketActivity model...\n"
    );

    await connectToDatabase();
    await cleanFixtures();

    await TicketActivity.createIndexes();

    console.log(
        "1. Testing ticket-created activity"
    );

    const createdActivity =
        await TicketActivity.create({
            workspace:
                workspaceId,

            ticket:
                ticketId,

            type:
                TICKET_ACTIVITY_TYPES.TICKET_CREATED,

            actorUser:
                actorUserId,

            entityType:
                TICKET_ACTIVITY_ENTITY_TYPES.TICKET,

            entityId:
                ticketId,

            metadata: {
                ticketNumber:
                    1001,
            },
        });

    assert.ok(
        createdActivity._id
    );

    assert.ok(
        createdActivity.createdAt
    );

    printPassed(
        "Ticket-created activity was stored"
    );

    console.log(
        "\n2. Testing change history"
    );

    const updateActivity =
        await TicketActivity.create({
            workspace:
                workspaceId,

            ticket:
                ticketId,

            type:
                TICKET_ACTIVITY_TYPES.TICKET_UPDATED,

            actorUser:
                actorUserId,

            entityType:
                TICKET_ACTIVITY_ENTITY_TYPES.TICKET,

            entityId:
                ticketId,

            changes: [
                {
                    field:
                        "priority",

                    from:
                        "normal",

                    to:
                        "urgent",
                },
            ],
        });

    assert.equal(
        updateActivity.changes.length,
        1
    );

    assert.equal(
        updateActivity.changes[0].field,
        "priority"
    );

    assert.equal(
        updateActivity.changes[0].from,
        "normal"
    );

    assert.equal(
        updateActivity.changes[0].to,
        "urgent"
    );

    printPassed(
        "Field changes were stored"
    );

    console.log(
        "\n3. Testing message activity"
    );

    const messageActivity =
        await TicketActivity.create({
            workspace:
                workspaceId,

            ticket:
                ticketId,

            type:
                TICKET_ACTIVITY_TYPES.PUBLIC_REPLY_ADDED,

            actorUser:
                actorUserId,

            entityType:
                TICKET_ACTIVITY_ENTITY_TYPES.MESSAGE,

            entityId:
                messageId,
        });

    assert.equal(
        messageActivity.entityId.toString(),
        messageId.toString()
    );

    printPassed(
        "Message activity was stored"
    );

    console.log(
        "\n4. Testing invalid message activity"
    );

    await expectValidationFailure({
        document:
            new TicketActivity({
                workspace:
                    workspaceId,

                ticket:
                    ticketId,

                type:
                    TICKET_ACTIVITY_TYPES.PUBLIC_REPLY_ADDED,

                actorUser:
                    actorUserId,

                entityType:
                    TICKET_ACTIVITY_ENTITY_TYPES.TICKET,

                entityId:
                    ticketId,
            }),

        expectedPath:
            "entityType",
    });

    printPassed(
        "Invalid message entity type was rejected"
    );

    console.log(
        "\n5. Testing missing message entity ID"
    );

    await expectValidationFailure({
        document:
            new TicketActivity({
                workspace:
                    workspaceId,

                ticket:
                    ticketId,

                type:
                    TICKET_ACTIVITY_TYPES.INTERNAL_NOTE_ADDED,

                actorUser:
                    actorUserId,

                entityType:
                    TICKET_ACTIVITY_ENTITY_TYPES.MESSAGE,
            }),

        expectedPath:
            "entityId",
    });

    printPassed(
        "Message activity without message ID was rejected"
    );

    console.log(
        "\n6. Testing chronological timeline"
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

    assert.equal(
        activities[0].type,
        TICKET_ACTIVITY_TYPES.TICKET_CREATED
    );

    printPassed(
        "Activities were returned chronologically"
    );

    console.log(
        "\n7. Testing timeline indexes"
    );

    const indexes =
        await TicketActivity.collection.indexes();

    const indexNames =
        indexes.map(
            (index) =>
                index.name
        );

    assert.ok(
        indexNames.includes(
            "ticket_activity_timeline"
        )
    );

    assert.ok(
        indexNames.includes(
            "ticket_activity_actor_history"
        )
    );

    assert.ok(
        indexNames.includes(
            "ticket_activity_type_history"
        )
    );

    printPassed(
        "Activity indexes exist"
    );

    console.log(
        "\nTicketActivity model verification completed successfully."
    );
}

verifyTicketActivityModel()
    .catch((error) => {
        console.error(
            "\nTicketActivity model verification failed:"
        );

        console.error(error);

        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await cleanFixtures();

            console.log(
                "\nTemporary activity fixtures cleaned up"
            );
        } catch (cleanupError) {
            console.error(
                "\nActivity fixture cleanup failed:"
            );

            console.error(
                cleanupError
            );

            process.exitCode = 1;
        } finally {
            await mongoose.disconnect();
        }
    });