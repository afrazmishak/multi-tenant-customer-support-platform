
import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";

import app from "../../src/app.js";

import {
    withIsolatedDatabase,
} from "../helpers/withIsolatedDatabase.js";
import { compare } from "bcryptjs";

test(
    "Express handles HTTP requests with an isolated test database",
    async () => {
        await withIsolatedDatabase(async ({ connection }) => {
            assert.equal(connection.readyState, 1);

            assert.equal(
                connection.name,
                "customer_support_test"
            );

            const response = await request(app)
                .get("/")
                .expect(200);

            assert.deepEqual(response.body, {
                success: true,
                message:
                    "Welcome to the Multi-Tenant Customer Support Platform API",
            });
        });
    }
);

test(
    "Isolated database disconnects after test completion",
    async () => {
        assert.equal(mongoose.connection.readyState, 0);

        await withIsolatedDatabase(async ({ connection }) => {
            assert.equal(connection.readyState, 1);
        });

        assert.equal(
            mongoose.connection.readyState,
            0,
            "Mongoose must disconnect after the test"
        );
    }
);