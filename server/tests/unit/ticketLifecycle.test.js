import test from "node:test";
import assert from "node:assert/strict";

import {
    getAllowedTicketStatusTransitions,
    assertTicketStatusTransition,
} from "../../src/services/ticketLifecycle.service.js";

test("Open ticket permits In Progress and Resolved", () => {
    const transitions =
        getAllowedTicketStatusTransitions("open");

    assert.deepEqual(transitions, [
        "in_progress",
        "resolved",
    ]);
});

test("Open ticket cannot transition directly to Waiting on Customer", () => {
    assert.throws(
        () => assertTicketStatusTransition({
            currentStatus: "open",
            nextStatus: "waiting_on_customer",
        }),
        {
            statusCode: 409,
        }
    );
});

test("In Progress ticket can transition to Waiting on Customer", () => {
    const result = assertTicketStatusTransition({
        currentStatus: "in_progress",
        nextStatus: "waiting_on_customer",
    });

    assert.deepEqual(result, {
        currentStatus: "in_progress",
        nextStatus: "waiting_on_customer",
    });
});

test("Resolved ticket can transition to Closed", () => {
    const result = assertTicketStatusTransition({
        currentStatus: "resolved",
        nextStatus: "closed",
    });

    assert.equal(result.nextStatus, "closed");
});

test("Closed tickets cannot transition to another status", () => {
    const transitions =
        getAllowedTicketStatusTransitions("closed");

    assert.deepEqual(transitions, []);
});
