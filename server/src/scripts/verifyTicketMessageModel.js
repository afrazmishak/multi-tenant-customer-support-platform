import assert from "node:assert/strict";
import "dotenv/config";
import mongoose from "mongoose";

import TicketMessage from "../models/TicketMessage.js";

import {
    TICKET_MESSAGE_TYPES,
} from "../constants/ticketMessage.constants.js";

const workspaceId =
    new mongoose.Types.ObjectId();

const ticketId =
    new mongoose.Types.ObjectId();

const authorUserId =
    new mongoose.Types.ObjectId();

const editorUserId =
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
        "Expected document validation to fail"
    );

    assert.ok(
        receivedError.errors?.[expectedPath],
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

    await mongoose.connect(databaseUri, {
        serverSelectionTimeoutMS: 10_000,
    });

    console.log("MongoDB connected");
}

async function cleanFixtures() {
    if (mongoose.connection.readyState !== 1) {
        return;
    }

    await TicketMessage.deleteMany({
        workspace: workspaceId,
    });
}

async function verifyTicketMessageModel() {
    console.log(
        "\nVerifying TicketMessage model...\n"
    );

    await connectToDatabase();
    await cleanFixtures();

    await TicketMessage.createIndexes();

    console.log(
        "1. Testing public reply creation"
    );

    const publicReply =
        await TicketMessage.create({
            workspace: workspaceId,
            ticket: ticketId,
            type:
                TICKET_MESSAGE_TYPES.PUBLIC_REPLY,

            body:
                "  Hello, the payment portal issue has been corrected.  ",

            authorUser: authorUserId,
        });

    assert.ok(publicReply._id);

    assert.equal(
        publicReply.body,
        "Hello, the payment portal issue has been corrected."
    );

    assert.equal(
        publicReply.type,
        "public_reply"
    );

    assert.equal(
        publicReply.visibility,
        "customer"
    );

    assert.equal(
        publicReply.isInternal,
        false
    );

    assert.ok(publicReply.createdAt);
    assert.ok(publicReply.updatedAt);

    printPassed(
        "Public reply was created and normalized"
    );

    console.log(
        "\n2. Testing internal-note creation"
    );

    const internalNote =
        await TicketMessage.create({
            workspace: workspaceId,
            ticket: ticketId,
            type:
                TICKET_MESSAGE_TYPES.INTERNAL_NOTE,

            body:
                "Customer is on the enterprise billing plan.",

            authorUser: authorUserId,
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
        "Internal note was created correctly"
    );

    console.log(
        "\n3. Testing required body validation"
    );

    await expectValidationFailure({
        document: new TicketMessage({
            workspace: workspaceId,
            ticket: ticketId,
            type:
                TICKET_MESSAGE_TYPES.PUBLIC_REPLY,

            body: "",
            authorUser: authorUserId,
        }),

        expectedPath: "body",
    });

    printPassed(
        "Empty message body was rejected"
    );

    console.log(
        "\n4. Testing invalid type validation"
    );

    await expectValidationFailure({
        document: new TicketMessage({
            workspace: workspaceId,
            ticket: ticketId,
            type: "private_reply",
            body: "Invalid message type",
            authorUser: authorUserId,
        }),

        expectedPath: "type",
    });

    printPassed(
        "Invalid message type was rejected"
    );

    console.log(
        "\n5. Testing required author validation"
    );

    await expectValidationFailure({
        document: new TicketMessage({
            workspace: workspaceId,
            ticket: ticketId,
            type:
                TICKET_MESSAGE_TYPES.INTERNAL_NOTE,

            body:
                "This message has no author.",
        }),

        expectedPath: "authorUser",
    });

    printPassed(
        "Message without an author was rejected"
    );

    console.log(
        "\n6. Testing incomplete editing metadata"
    );

    await expectValidationFailure({
        document: new TicketMessage({
            workspace: workspaceId,
            ticket: ticketId,
            type:
                TICKET_MESSAGE_TYPES.PUBLIC_REPLY,

            body:
                "Message with invalid edit metadata.",

            authorUser: authorUserId,
            editedAt: new Date(),
            editedBy: null,
        }),

        expectedPath: "editedBy",
    });

    await expectValidationFailure({
        document: new TicketMessage({
            workspace: workspaceId,
            ticket: ticketId,
            type:
                TICKET_MESSAGE_TYPES.PUBLIC_REPLY,

            body:
                "Another invalid edit record.",

            authorUser: authorUserId,
            editedAt: null,
            editedBy: editorUserId,
        }),

        expectedPath: "editedAt",
    });

    printPassed(
        "Incomplete editing metadata was rejected"
    );

    console.log(
        "\n7. Testing message editing metadata"
    );

    publicReply.body =
        "Hello, the payment portal issue has been corrected and verified.";

    publicReply.editedAt = new Date();
    publicReply.editedBy = editorUserId;

    await publicReply.save();

    assert.equal(
        publicReply.body,
        "Hello, the payment portal issue has been corrected and verified."
    );

    assert.ok(publicReply.editedAt);

    assert.equal(
        publicReply.editedBy.toString(),
        editorUserId.toString()
    );

    printPassed(
        "Message editing metadata was persisted"
    );

    console.log(
        "\n8. Testing immutable ownership fields"
    );

    const originalWorkspaceId =
        publicReply.workspace.toString();

    const originalTicketId =
        publicReply.ticket.toString();

    const originalAuthorUserId =
        publicReply.authorUser.toString();

    const originalType =
        publicReply.type;

    publicReply.workspace =
        new mongoose.Types.ObjectId();

    publicReply.ticket =
        new mongoose.Types.ObjectId();

    publicReply.authorUser =
        new mongoose.Types.ObjectId();

    publicReply.type =
        TICKET_MESSAGE_TYPES.INTERNAL_NOTE;

    await publicReply.save();

    assert.equal(
        publicReply.workspace.toString(),
        originalWorkspaceId
    );

    assert.equal(
        publicReply.ticket.toString(),
        originalTicketId
    );

    assert.equal(
        publicReply.authorUser.toString(),
        originalAuthorUserId
    );

    assert.equal(
        publicReply.type,
        originalType
    );

    printPassed(
        "Workspace, ticket, author, and type remained immutable"
    );

    console.log(
        "\n9. Testing timeline ordering"
    );

    const messages =
        await TicketMessage.find({
            workspace: workspaceId,
            ticket: ticketId,
        })
            .sort({
                createdAt: 1,
                _id: 1,
            })
            .lean();

    assert.equal(messages.length, 2);

    assert.equal(
        messages[0]._id.toString(),
        publicReply._id.toString()
    );

    assert.equal(
        messages[1]._id.toString(),
        internalNote._id.toString()
    );

    printPassed(
        "Ticket messages were returned chronologically"
    );

    console.log(
        "\n10. Testing database indexes"
    );

    const indexes =
        await TicketMessage.collection.indexes();

    const indexNames =
        indexes.map((index) => index.name);

    assert.ok(
        indexNames.includes(
            "ticket_message_timeline"
        )
    );

    assert.ok(
        indexNames.includes(
            "ticket_message_author_history"
        )
    );

    printPassed(
        "Ticket-message indexes exist"
    );

    console.log(
        "\nTicketMessage model verification completed successfully."
    );
}

verifyTicketMessageModel()
    .catch((error) => {
        console.error(
            "\nTicketMessage model verification failed:"
        );

        console.error(error);

        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await cleanFixtures();

            console.log(
                "\nTemporary ticket-message fixtures cleaned up"
            );
        } catch (cleanupError) {
            console.error(
                "\nFailed to clean ticket-message fixtures:"
            );

            console.error(cleanupError);

            process.exitCode = 1;
        } finally {
            await mongoose.disconnect();
        }
    });


