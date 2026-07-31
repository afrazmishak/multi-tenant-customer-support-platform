import assert from "node:assert/strict";
import "dotenv/config";
import mongoose from "mongoose";

import Customer from "../models/Customer.js";
import Membership from "../models/Membership.js";
import Ticket from "../models/Ticket.js";
import TicketCounter from "../models/TicketCounter.js";

import {
    assignTicket,
    changeTicketStatus,
    createTicket,
    getTicketById,
    listTickets,
    updateTicket,
} from "../services/ticket.service.js";

import {
    MEMBERSHIP_ROLES,
} from "../constants/membership.constants.js";

const workspaceAId = new mongoose.Types.ObjectId();
const workspaceBId = new mongoose.Types.ObjectId();

const ownerUserId = new mongoose.Types.ObjectId();
const agentUserId = new mongoose.Types.ObjectId();
const workspaceBMemberUserId =
    new mongoose.Types.ObjectId();

const testRunId = new mongoose.Types.ObjectId()
    .toString()
    .slice(-8);

function printPassed(message) {
    console.log(`✓ ${message}`);
}

function getErrorStatusCode(error) {
    return error?.statusCode ?? error?.status;
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
        `Expected operation to fail with status ${expectedStatusCode}`
    );

    assert.equal(
        getErrorStatusCode(receivedError),
        expectedStatusCode,
        `Expected status ${expectedStatusCode}, received ${getErrorStatusCode(receivedError) ?? "undefined"
        }`
    );

    if (expectedMessagePattern) {
        assert.match(
            receivedError.message,
            expectedMessagePattern
        );
    }

    return receivedError;
}

async function connectToDatabase() {
    const databaseUri =
        process.env.MONGODB_URI ??
        process.env.MONGO_URI;

    assert.ok(
        databaseUri,
        "MONGODB_URI or MONGO_URI is missing from the environment"
    );

    await mongoose.connect(databaseUri, {
        serverSelectionTimeoutMS: 10_000,
    });

    await Promise.all([
        Ticket.createIndexes(),
        TicketCounter.createIndexes(),
        Customer.createIndexes(),
    ]);

    console.log("MongoDB connected");
}

async function cleanFixtures() {
    if (mongoose.connection.readyState !== 1) {
        return;
    }

    const workspaceFilter = {
        $in: [
            workspaceAId,
            workspaceBId,
        ],
    };

    await Ticket.deleteMany({
        workspace: workspaceFilter,
    });

    await TicketCounter.deleteMany({
        workspace: workspaceFilter,
    });

    await Customer.deleteMany({
        workspace: workspaceFilter,
    });

    await Membership.deleteMany({
        tenantId: workspaceFilter,
    });
}

async function createFixtures() {
    const customerA = await Customer.create({
        workspace: workspaceAId,
        name: "Ticket Test Customer A",
        email: `ticket-a-${testRunId}@example.com`,
        tags: ["integration-test"],
        createdBy: ownerUserId,
        updatedBy: ownerUserId,
    });

    const customerB = await Customer.create({
        workspace: workspaceBId,
        name: "Ticket Test Customer B",
        email: `ticket-b-${testRunId}@example.com`,
        tags: ["integration-test"],
        createdBy: workspaceBMemberUserId,
        updatedBy: workspaceBMemberUserId,
    });

    /*
     * Direct collection insertion is intentional here.
     *
     * The ticket service only needs workspace, user, role,
     * and status. MongoDB references do not require actual
     * Workspace or User documents for this isolated test.
     */
    await Membership.collection.insertMany([
        {
            tenantId: workspaceAId,
            userId: ownerUserId,
            role: MEMBERSHIP_ROLES.OWNER,
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            tenantId: workspaceAId,
            userId: agentUserId,
            role: MEMBERSHIP_ROLES.AGENT,
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            tenantId: workspaceBId,
            userId: workspaceBMemberUserId,
            role: MEMBERSHIP_ROLES.AGENT,
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    ]);

    return {
        customerA,
        customerB,
    };
}

async function verifyTicketService() {
    console.log(
        "\nVerifying Ticket service integration...\n"
    );

    await connectToDatabase();
    await cleanFixtures();

    const {
        customerA,
        customerB,
    } = await createFixtures();

    console.log("1. Testing ticket creation");

    const primaryTicket = await createTicket({
        workspaceId: workspaceAId,
        actorUserId: ownerUserId,
        input: {
            customerId:
                customerA._id.toString(),

            subject:
                "Payment portal is unavailable",

            description:
                "The customer receives an error when opening the payment portal.",

            priority: "urgent",
            source: "email",
            category: "Billing",

            tags: [
                "VIP",
                "Billing",
                "vip",
            ],

            assignedTo:
                agentUserId.toString(),
        },
    });

    assert.ok(primaryTicket._id);
    assert.equal(primaryTicket.ticketNumber, 1);
    assert.equal(
        primaryTicket.reference,
        "TKT-000001"
    );

    assert.equal(
        primaryTicket.workspace.toString(),
        workspaceAId.toString()
    );

    assert.equal(
        primaryTicket.customer.toString(),
        customerA._id.toString()
    );

    assert.equal(
        primaryTicket.assignedTo.toString(),
        agentUserId.toString()
    );

    assert.deepEqual(
        primaryTicket.tags,
        ["vip", "billing"]
    );

    assert.equal(primaryTicket.status, "open");
    assert.equal(primaryTicket.priority, "urgent");

    printPassed(
        "Ticket was created with normalized values"
    );

    console.log(
        "\n2. Testing concurrent ticket-number allocation"
    );

    const additionalTicketInputs = [
        {
            subject: "Unable to reset password",
            description:
                "Password reset email is not arriving.",
            priority: "high",
            source: "web",
            category: "Account",
            tags: ["account"],
        },
        {
            subject: "Invoice copy requested",
            description:
                "The customer needs a copy of the latest invoice.",
            priority: "normal",
            source: "phone",
            category: "Billing",
            tags: ["billing"],
        },
        {
            subject: "Application loads slowly",
            description:
                "The dashboard takes more than ten seconds to load.",
            priority: "normal",
            source: "chat",
            category: "Performance",
            tags: ["performance"],
        },
        {
            subject: "Feature information requested",
            description:
                "The customer wants information about team permissions.",
            priority: "low",
            source: "internal",
            category: "Product",
            tags: ["product"],
        },
    ];

    const additionalTickets = await Promise.all(
        additionalTicketInputs.map((input) =>
            createTicket({
                workspaceId: workspaceAId,
                actorUserId: ownerUserId,
                input: {
                    customerId:
                        customerA._id.toString(),
                    ...input,
                },
            })
        )
    );

    const additionalTicketNumbers =
        additionalTickets
            .map((ticket) => ticket.ticketNumber)
            .sort((first, second) => first - second);

    assert.deepEqual(
        additionalTicketNumbers,
        [2, 3, 4, 5]
    );

    assert.equal(
        new Set(additionalTicketNumbers).size,
        4
    );

    printPassed(
        "Concurrent ticket creation generated unique sequential numbers"
    );

    console.log(
        "\n3. Testing workspace-scoped numbering"
    );

    const workspaceBTicket = await createTicket({
        workspaceId: workspaceBId,
        actorUserId: workspaceBMemberUserId,
        input: {
            customerId:
                customerB._id.toString(),

            subject: "Workspace B ticket",

            description:
                "This ticket belongs to another workspace.",

            priority: "normal",
            source: "internal",
        },
    });

    assert.equal(
        workspaceBTicket.ticketNumber,
        1
    );

    assert.equal(
        workspaceBTicket.reference,
        "TKT-000001"
    );

    printPassed(
        "Each workspace has its own ticket-number sequence"
    );

    console.log(
        "\n4. Testing cross-workspace customer protection"
    );

    await expectServiceError(
        () =>
            createTicket({
                workspaceId: workspaceAId,
                actorUserId: ownerUserId,
                input: {
                    customerId:
                        customerB._id.toString(),

                    subject:
                        "Illegal cross-tenant ticket",

                    description:
                        "This ticket must not be created.",
                },
            }),
        404,
        /customer was not found/i
    );

    printPassed(
        "Workspace A cannot create a ticket for Workspace B's customer"
    );

    console.log(
        "\n5. Testing cross-workspace assignee protection"
    );

    await expectServiceError(
        () =>
            createTicket({
                workspaceId: workspaceAId,
                actorUserId: ownerUserId,
                input: {
                    customerId:
                        customerA._id.toString(),

                    subject:
                        "Illegal assignment ticket",

                    description:
                        "This ticket must not be assigned outside the workspace.",

                    assignedTo:
                        workspaceBMemberUserId.toString(),
                },
            }),
        409,
        /not an active member of this workspace/i
    );

    printPassed(
        "A member of another workspace cannot be assigned"
    );

    console.log(
        "\n6. Testing ticket queue listing"
    );

    const allWorkspaceATickets =
        await listTickets({
            workspaceId: workspaceAId,
        });

    assert.equal(
        allWorkspaceATickets.pagination
            .totalTickets,
        5
    );

    assert.equal(
        allWorkspaceATickets.tickets.length,
        5
    );

    for (
        const ticket
        of allWorkspaceATickets.tickets
    ) {
        assert.equal(
            ticket.workspace.toString(),
            workspaceAId.toString()
        );

        assert.ok(ticket.reference);
    }

    printPassed(
        "Ticket listing is restricted to the requested workspace"
    );

    console.log(
        "\n7. Testing pagination"
    );

    const firstPage = await listTickets({
        workspaceId: workspaceAId,
        query: {
            page: "1",
            limit: "2",
            sortBy: "ticketNumber",
            sortOrder: "asc",
        },
    });

    assert.equal(firstPage.tickets.length, 2);

    assert.equal(
        firstPage.pagination.totalTickets,
        5
    );

    assert.equal(
        firstPage.pagination.totalPages,
        3
    );

    assert.equal(
        firstPage.pagination.hasNextPage,
        true
    );

    assert.equal(
        firstPage.pagination.hasPreviousPage,
        false
    );

    assert.deepEqual(
        firstPage.tickets.map(
            (ticket) => ticket.ticketNumber
        ),
        [1, 2]
    );

    printPassed(
        "Ticket pagination returned correct results"
    );

    console.log(
        "\n8. Testing priority filtering"
    );

    const urgentTickets = await listTickets({
        workspaceId: workspaceAId,
        query: {
            priority: "urgent",
        },
    });

    assert.equal(
        urgentTickets.pagination.totalTickets,
        1
    );

    assert.equal(
        urgentTickets.tickets[0]._id.toString(),
        primaryTicket._id.toString()
    );

    printPassed("Priority filtering works");

    console.log(
        "\n9. Testing assigned and unassigned filtering"
    );

    const assignedTickets = await listTickets({
        workspaceId: workspaceAId,
        query: {
            assignedTo:
                agentUserId.toString(),
        },
    });

    assert.equal(
        assignedTickets.pagination.totalTickets,
        1
    );

    const unassignedTickets = await listTickets({
        workspaceId: workspaceAId,
        query: {
            assignedTo: "unassigned",
        },
    });

    assert.equal(
        unassignedTickets.pagination.totalTickets,
        4
    );

    printPassed(
        "Assigned and unassigned queue filters work"
    );

    console.log(
        "\n10. Testing customer and tag filtering"
    );

    const customerTickets = await listTickets({
        workspaceId: workspaceAId,
        query: {
            customerId:
                customerA._id.toString(),
        },
    });

    assert.equal(
        customerTickets.pagination.totalTickets,
        5
    );

    const billingTickets = await listTickets({
        workspaceId: workspaceAId,
        query: {
            tags: "billing",
        },
    });

    assert.equal(
        billingTickets.pagination.totalTickets,
        2
    );

    printPassed(
        "Customer and tag filtering work"
    );

    console.log(
        "\n11. Testing ticket search"
    );

    const referenceSearch = await listTickets({
        workspaceId: workspaceAId,
        query: {
            search: "TKT-000001",
        },
    });

    assert.equal(
        referenceSearch.pagination.totalTickets,
        1
    );

    assert.equal(
        referenceSearch.tickets[0]._id.toString(),
        primaryTicket._id.toString()
    );

    const subjectSearch = await listTickets({
        workspaceId: workspaceAId,
        query: {
            search: "payment portal",
        },
    });

    assert.equal(
        subjectSearch.pagination.totalTickets,
        1
    );

    printPassed(
        "Ticket reference and text search work"
    );

    console.log(
        "\n12. Testing tenant-safe ticket retrieval"
    );

    const retrievedTicket = await getTicketById({
        workspaceId: workspaceAId,
        ticketId: primaryTicket._id,
    });

    assert.equal(
        retrievedTicket._id.toString(),
        primaryTicket._id.toString()
    );

    await expectServiceError(
        () =>
            getTicketById({
                workspaceId: workspaceBId,
                ticketId:
                    primaryTicket._id,
            }),
        404,
        /ticket was not found/i
    );

    printPassed(
        "Workspace B cannot retrieve Workspace A's ticket"
    );

    console.log(
        "\n13. Testing basic ticket updates"
    );

    const updatedTicket = await updateTicket({
        workspaceId: workspaceAId,
        ticketId: primaryTicket._id,
        actorUserId: ownerUserId,
        input: {
            subject:
                "Payment portal is unavailable - updated",

            priority: "high",
            category: "Payments",

            tags: [
                "Enterprise",
                "Billing",
                "enterprise",
            ],
        },
    });

    assert.equal(
        updatedTicket.subject,
        "Payment portal is unavailable - updated"
    );

    assert.equal(
        updatedTicket.priority,
        "high"
    );

    assert.equal(
        updatedTicket.category,
        "Payments"
    );

    assert.deepEqual(
        updatedTicket.tags,
        ["enterprise", "billing"]
    );

    printPassed(
        "Basic ticket fields were updated"
    );

    console.log(
        "\n14. Testing protected generic updates"
    );

    await expectServiceError(
        () =>
            updateTicket({
                workspaceId:
                    workspaceAId,

                ticketId:
                    primaryTicket._id,

                actorUserId:
                    ownerUserId,

                input: {
                    status: "resolved",
                },
            }),
        400,
        /unsupported ticket field/i
    );

    printPassed(
        "Generic updates cannot bypass lifecycle rules"
    );

    console.log(
        "\n15. Testing assignment operations"
    );

    await expectServiceError(
        () =>
            assignTicket({
                workspaceId:
                    workspaceAId,

                ticketId:
                    primaryTicket._id,

                actorUserId:
                    ownerUserId,

                input: {
                    assignedTo:
                        agentUserId.toString(),
                },
            }),
        409,
        /already assigned/i
    );

    const unassignedTicket = await assignTicket({
        workspaceId: workspaceAId,
        ticketId: primaryTicket._id,
        actorUserId: ownerUserId,
        input: {
            assignedTo: null,
        },
    });

    assert.equal(
        unassignedTicket.assignedTo,
        null
    );

    assert.equal(
        unassignedTicket.assignedAt,
        null
    );

    assert.equal(
        unassignedTicket.assignedBy,
        null
    );

    await expectServiceError(
        () =>
            assignTicket({
                workspaceId:
                    workspaceAId,

                ticketId:
                    primaryTicket._id,

                actorUserId:
                    ownerUserId,

                input: {
                    assignedTo: null,
                },
            }),
        409,
        /already unassigned/i
    );

    await expectServiceError(
        () =>
            assignTicket({
                workspaceId:
                    workspaceAId,

                ticketId:
                    primaryTicket._id,

                actorUserId:
                    ownerUserId,

                input: {
                    assignedTo:
                        workspaceBMemberUserId.toString(),
                },
            }),
        409,
        /not an active member/i
    );

    const reassignedTicket = await assignTicket({
        workspaceId: workspaceAId,
        ticketId: primaryTicket._id,
        actorUserId: ownerUserId,
        input: {
            assignedTo:
                agentUserId.toString(),
        },
    });

    assert.equal(
        reassignedTicket.assignedTo.toString(),
        agentUserId.toString()
    );

    printPassed(
        "Assignment and unassignment rules work"
    );

    console.log(
        "\n16. Testing lifecycle persistence"
    );

    const inProgressTicket =
        await changeTicketStatus({
            workspaceId:
                workspaceAId,

            ticketId:
                primaryTicket._id,

            actorUserId:
                agentUserId,

            input: {
                status: "in_progress",
            },
        });

    assert.equal(
        inProgressTicket.status,
        "in_progress"
    );

    await expectServiceError(
        () =>
            changeTicketStatus({
                workspaceId:
                    workspaceAId,

                ticketId:
                    primaryTicket._id,

                actorUserId:
                    agentUserId,

                input: {
                    status: "closed",
                },
            }),
        409,
        /cannot transition/i
    );

    const waitingTicket =
        await changeTicketStatus({
            workspaceId:
                workspaceAId,

            ticketId:
                primaryTicket._id,

            actorUserId:
                agentUserId,

            input: {
                status:
                    "waiting_on_customer",
            },
        });

    assert.equal(
        waitingTicket.status,
        "waiting_on_customer"
    );

    await changeTicketStatus({
        workspaceId: workspaceAId,
        ticketId: primaryTicket._id,
        actorUserId: agentUserId,
        input: {
            status: "in_progress",
        },
    });

    await expectServiceError(
        () =>
            changeTicketStatus({
                workspaceId:
                    workspaceAId,

                ticketId:
                    primaryTicket._id,

                actorUserId:
                    agentUserId,

                input: {
                    status: "resolved",
                },
            }),
        400,
        /resolution summary is required/i
    );

    const resolvedTicket =
        await changeTicketStatus({
            workspaceId:
                workspaceAId,

            ticketId:
                primaryTicket._id,

            actorUserId:
                agentUserId,

            input: {
                status: "resolved",

                resolutionSummary:
                    "The payment portal configuration was corrected and verified with the customer.",
            },
        });

    assert.equal(
        resolvedTicket.status,
        "resolved"
    );

    assert.ok(resolvedTicket.resolvedAt);

    assert.equal(
        resolvedTicket.resolvedBy.toString(),
        agentUserId.toString()
    );

    assert.equal(
        resolvedTicket.resolutionSummary,
        "The payment portal configuration was corrected and verified with the customer."
    );

    const closedTicket =
        await changeTicketStatus({
            workspaceId:
                workspaceAId,

            ticketId:
                primaryTicket._id,

            actorUserId:
                ownerUserId,

            input: {
                status: "closed",
            },
        });

    assert.equal(
        closedTicket.status,
        "closed"
    );

    assert.ok(closedTicket.closedAt);

    assert.equal(
        closedTicket.closedBy.toString(),
        ownerUserId.toString()
    );

    printPassed(
        "Ticket lifecycle changes were persisted"
    );

    console.log(
        "\n17. Testing closed-ticket protections"
    );

    await expectServiceError(
        () =>
            updateTicket({
                workspaceId:
                    workspaceAId,

                ticketId:
                    primaryTicket._id,

                actorUserId:
                    ownerUserId,

                input: {
                    subject:
                        "Illegal closed-ticket update",
                },
            }),
        409,
        /closed tickets cannot be updated/i
    );

    await expectServiceError(
        () =>
            assignTicket({
                workspaceId:
                    workspaceAId,

                ticketId:
                    primaryTicket._id,

                actorUserId:
                    ownerUserId,

                input: {
                    assignedTo: null,
                },
            }),
        409,
        /closed tickets cannot be reassigned/i
    );

    await expectServiceError(
        () =>
            changeTicketStatus({
                workspaceId:
                    workspaceAId,

                ticketId:
                    primaryTicket._id,

                actorUserId:
                    ownerUserId,

                input: {
                    status: "in_progress",
                },
            }),
        409,
        /cannot transition/i
    );

    const persistedClosedTicket =
        await getTicketById({
            workspaceId:
                workspaceAId,

            ticketId:
                primaryTicket._id,
        });

    assert.equal(
        persistedClosedTicket.status,
        "closed"
    );

    assert.ok(
        persistedClosedTicket.resolvedAt
    );

    assert.ok(
        persistedClosedTicket.closedAt
    );

    printPassed(
        "Closed tickets reject further changes"
    );

    console.log(
        "\nTicket service integration verification completed successfully."
    );
}

verifyTicketService()
    .catch((error) => {
        console.error(
            "\nTicket service integration verification failed:"
        );

        console.error(error);

        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await cleanFixtures();

            console.log(
                "\nTemporary ticket fixtures cleaned up"
            );
        } catch (cleanupError) {
            console.error(
                "\nFailed to clean temporary ticket fixtures:"
            );

            console.error(cleanupError);

            process.exitCode = 1;
        } finally {
            await mongoose.disconnect();
        }
    });