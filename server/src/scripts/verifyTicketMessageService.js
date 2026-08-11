import assert from "node:assert/strict";
import "dotenv/config";
import mongoose from "mongoose";

import Ticket from "../models/Ticket.js";
import TicketMessage from "../models/TicketMessage.js";

import {
    TICKET_STATUSES,
} from "../constants/ticket.constants.js";

import {
    TICKET_MESSAGE_TYPES,
} from "../constants/ticketMessage.constants.js";

import TicketActivity
    from "../models/TicketActivity.js";

import {
    createTicketMessage,
    getTicketMessageById,
    listTicketMessages,
    updateTicketMessage,
} from "../services/ticketMessage.service.js";

const workspaceAId =
    new mongoose.Types.ObjectId();

const workspaceBId =
    new mongoose.Types.ObjectId();

const customerId =
    new mongoose.Types.ObjectId();

const authorUserId =
    new mongoose.Types.ObjectId();

const secondAuthorUserId =
    new mongoose.Types.ObjectId();

let openTicket = null;
let closedTicket = null;

function printPassed(message) {
    console.log(`✓ ${message}`);
}

function getErrorStatusCode(error) {
    return (
        error?.statusCode ??
        error?.status
    );
}

async function expectServiceError(
    operation,
    expectedStatusCode,
    expectedMessagePattern
) {
    let receivedError = null;

    try {
        await operation();
    } catch (error) {
        receivedError = error;
    }

    assert.ok(
        receivedError,
        `Expected status ${expectedStatusCode}`
    );

    assert.equal(
        getErrorStatusCode(
            receivedError
        ),
        expectedStatusCode
    );

    if (expectedMessagePattern) {
        assert.match(
            receivedError.message,
            expectedMessagePattern
        );
    }
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

    await TicketMessage.createIndexes();

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

    await TicketMessage.deleteMany({
        workspace: {
            $in: [
                workspaceAId,
                workspaceBId,
            ],
        },
    });

    await TicketActivity.deleteMany({
        workspace: {
            $in: [
                workspaceAId,
                workspaceBId,
            ],
        },
    });

    await Ticket.deleteMany({
        workspace: {
            $in: [
                workspaceAId,
                workspaceBId,
            ],
        },
    });
}

async function createFixtures() {
    openTicket = await Ticket.create({
        workspace:
            workspaceAId,

        ticketNumber:
            900001,

        customer:
            customerId,

        subject:
            "Ticket message service test",

        description:
            "An open ticket used for message integration testing.",

        status:
            TICKET_STATUSES.OPEN,

        createdBy:
            authorUserId,

        updatedBy:
            authorUserId,
    });

    const resolvedAt =
        new Date(
            Date.now() - 60_000
        );

    closedTicket =
        await Ticket.create({
            workspace:
                workspaceAId,

            ticketNumber:
                900002,

            customer:
                customerId,

            subject:
                "Closed ticket test",

            description:
                "A closed ticket used for message protection testing.",

            status:
                TICKET_STATUSES.CLOSED,

            createdBy:
                authorUserId,

            updatedBy:
                authorUserId,

            resolvedAt,

            resolvedBy:
                authorUserId,

            resolutionSummary:
                "The test issue was resolved.",

            closedAt:
                new Date(),

            closedBy:
                authorUserId,
        });
}

async function verifyService() {
    console.log(
        "\nVerifying TicketMessage service...\n"
    );

    await connectToDatabase();
    await cleanFixtures();
    await createFixtures();

    console.log(
        "1. Testing public-reply creation"
    );

    const publicReply =
        await createTicketMessage({
            workspaceId:
                workspaceAId,

            ticketId:
                openTicket._id,

            actorUserId:
                authorUserId,

            input: {
                type:
                    TICKET_MESSAGE_TYPES.PUBLIC_REPLY,

                body:
                    "  Hello, we are investigating the payment issue.  ",
            },
        });

    assert.equal(
        publicReply.body,
        "Hello, we are investigating the payment issue."
    );

    assert.equal(
        publicReply.visibility,
        "customer"
    );

    assert.equal(
        publicReply.isInternal,
        false
    );

    printPassed(
        "Public reply was created"
    );

    console.log(
        "\n2. Testing internal-note creation"
    );

    const internalNote =
        await createTicketMessage({
            workspaceId:
                workspaceAId,

            ticketId:
                openTicket._id,

            actorUserId:
                authorUserId,

            input: {
                type:
                    TICKET_MESSAGE_TYPES.INTERNAL_NOTE,

                body:
                    "Customer has an enterprise subscription.",
            },
        });

    assert.equal(
        internalNote.visibility,
        "internal"
    );

    assert.equal(
        internalNote.isInternal,
        true
    );

    printPassed(
        "Internal note was created"
    );

    console.log(
        "\n3. Testing ticket activity update"
    );

    const refreshedTicket =
        await Ticket.findById(
            openTicket._id
        ).lean();

    assert.ok(
        refreshedTicket.lastActivityAt
    );

    assert.equal(
        refreshedTicket.updatedBy.toString(),
        authorUserId.toString()
    );

    printPassed(
        "Ticket activity was updated"
    );

    console.log(
        "\n4. Testing chronological listing"
    );

    const timeline =
        await listTicketMessages({
            workspaceId:
                workspaceAId,

            ticketId:
                openTicket._id,

            query: {
                sortOrder: "asc",
            },
        });

    assert.equal(
        timeline.pagination.totalMessages,
        2
    );

    assert.equal(
        timeline.messages[0]._id.toString(),
        publicReply._id.toString()
    );

    assert.equal(
        timeline.messages[1]._id.toString(),
        internalNote._id.toString()
    );

    printPassed(
        "Messages were listed chronologically"
    );

    console.log(
        "\n5. Testing message-type filtering"
    );

    const publicMessages =
        await listTicketMessages({
            workspaceId:
                workspaceAId,

            ticketId:
                openTicket._id,

            query: {
                type: "public_reply",
            },
        });

    assert.equal(
        publicMessages.pagination.totalMessages,
        1
    );

    assert.equal(
        publicMessages.messages[0].type,
        "public_reply"
    );

    printPassed(
        "Message filtering works"
    );

    console.log(
        "\n6. Testing tenant-safe retrieval"
    );

    const retrievedMessage =
        await getTicketMessageById({
            workspaceId:
                workspaceAId,

            ticketId:
                openTicket._id,

            messageId:
                publicReply._id,
        });

    assert.equal(
        retrievedMessage._id.toString(),
        publicReply._id.toString()
    );

    await expectServiceError(
        () =>
            getTicketMessageById({
                workspaceId:
                    workspaceBId,

                ticketId:
                    openTicket._id,

                messageId:
                    publicReply._id,
            }),

        404,
        /ticket was not found/i
    );

    printPassed(
        "Cross-workspace retrieval was blocked"
    );

    console.log(
        "\n7. Testing author editing"
    );

    const editedMessage =
        await updateTicketMessage({
            workspaceId:
                workspaceAId,

            ticketId:
                openTicket._id,

            messageId:
                publicReply._id,

            actorUserId:
                authorUserId,

            input: {
                body:
                    "The payment issue has been investigated and corrected.",
            },
        });

    assert.equal(
        editedMessage.body,
        "The payment issue has been investigated and corrected."
    );

    assert.ok(
        editedMessage.editedAt
    );

    assert.equal(
        editedMessage.editedBy.toString(),
        authorUserId.toString()
    );

    printPassed(
        "Original author edited the message"
    );

    console.log(
        "\n8. Testing non-author protection"
    );

    await expectServiceError(
        () =>
            updateTicketMessage({
                workspaceId:
                    workspaceAId,

                ticketId:
                    openTicket._id,

                messageId:
                    publicReply._id,

                actorUserId:
                    secondAuthorUserId,

                input: {
                    body:
                        "Unauthorized edit attempt.",
                },
            }),

        403,
        /only the original author/i
    );

    printPassed(
        "Another user could not edit the message"
    );

    console.log(
        "\n9. Testing protected message fields"
    );

    await expectServiceError(
        () =>
            updateTicketMessage({
                workspaceId:
                    workspaceAId,

                ticketId:
                    openTicket._id,

                messageId:
                    publicReply._id,

                actorUserId:
                    authorUserId,

                input: {
                    type:
                        "internal_note",
                },
            }),

        400,
        /unsupported ticket message update fields/i
    );

    printPassed(
        "Message type could not be changed"
    );

    console.log(
        "\n10. Testing closed-ticket protection"
    );

    await expectServiceError(
        () =>
            createTicketMessage({
                workspaceId:
                    workspaceAId,

                ticketId:
                    closedTicket._id,

                actorUserId:
                    authorUserId,

                input: {
                    type:
                        "internal_note",

                    body:
                        "This should not be created.",
                },
            }),

        409,
        /closed tickets cannot/i
    );

    await expectServiceError(
        () =>
            updateTicketMessage({
                workspaceId:
                    workspaceAId,

                ticketId:
                    closedTicket._id,

                messageId:
                    publicReply._id,

                actorUserId:
                    authorUserId,

                input: {
                    body:
                        "This should not be updated.",
                },
            }),

        409,
        /closed tickets cannot/i
    );

    printPassed(
        "Closed tickets rejected message changes"
    );

    console.log(
        "\nTicketMessage service verification completed successfully."
    );
}

verifyService()
    .catch((error) => {
        console.error(
            "\nTicketMessage service verification failed:"
        );

        console.error(error);

        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await cleanFixtures();

            console.log(
                "\nTemporary message-service fixtures cleaned up"
            );
        } catch (cleanupError) {
            console.error(
                "\nFailed to clean fixtures:"
            );

            console.error(
                cleanupError
            );

            process.exitCode = 1;
        } finally {
            await mongoose.disconnect();
        }
    });