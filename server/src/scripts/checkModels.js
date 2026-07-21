import "dotenv/config";

import {
    connectDatabase,
    disconnectDatabase,
} from "../config/database.js";
import { initializeModels } from "../models/index.js";

async function checkModels() {
    try {
        await connectDatabase();
        await initializeModels();

        console.log("Tenant model: ready");
        console.log("User model: ready");
        console.log("Membership model: ready");
        console.log("Model verification completed successfully");
    } catch (error) {
        console.log("Model verification failed:", error.message);
        process.exitCode = 1;
    } finally {
        await disconnectDatabase();
    }
}

checkModels();