import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
    withIsolatedReplicaSet,
} from "../helpers/withIsolatedReplicaSet.js";

test("isolated MongoDB supports commit and rollback", async () => {
    await withIsolatedReplicaSet(async ({ connection }) => {
        const schema = new mongoose.Schema({
            label: {
                type: String,
                required: true,
            },
        });

        const Record = connection.model(
            "TransactionSmokeRecord",
            schema
        );

        await Record.init();

        // Test 1: A successful transaction must commit.
        await connection.transaction(async (session) => {
            const createdRecords = await Record.create(
                [{ label: "committed" }],
                { session }
            );

            // Verify Mongoose created the expected record.
            assert.equal(createdRecords.length, 1);

            assert.equal(
                createdRecords[0].label,
                "committed"
            );

            /// Verify the record is visible inside the transaction.
            const insideCount = await Record.countDocuments({
                label: "committed",
            }).session(session);

            assert.equal(
                insideCount,
                1,
                "Record must exist inside the transaction"
            );
        });

        // Verify the committed record exists.
        const committedCount =
            await Record.countDocuments({
                label: "committed",
            });

        assert.equal(
            committedCount,
            1,
            "Committed record should exist in MongoDB"
        );

        // Test 2: A failed transaction must roll back.
        await assert.rejects(
            connection.transaction(async (session) => {
                await Record.create(
                    [{ label: "rolled-back" }],
                    { session }
                );

                throw new Error("intentional rollback");
            }),
            /intentional rollback/
        );

        // Verify the failed transaction inserted nothing.
        const rolledBackCount =
            await Record.countDocuments({
                label: "rolled-back",
            });

        assert.equal(
            rolledBackCount,
            0,
            "Rolled-back record must not exist in MongoDB"
        );
    });
});