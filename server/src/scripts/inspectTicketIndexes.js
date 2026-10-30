import "dotenv/config";
import mongoose, { mongo } from "mongoose";


import Ticket from "../models/Ticket.js";

async function inspectTicketIndexes() {
    if (!process.env.MONGODB_URI) {
        throw new Error(
            "MONGODB_URI is required"
        );
    }

    await mongoose.connect(
        process.env.MONGODB_URI
    );

    console.log(
        `Connected to database: ${mongoose.connection.name}`
    );

    const indexes =
        await Ticket.collection.indexes();

    console.log("\nTicket collection indexes:");

    for (const index of indexes) {
        console.log("n----------------");

        console.log(
            `Name: ${index.name}`
        );

        console.log(
            "Fields:",
            JSON.stringify(index.key)
        );

        console.log(
            `Unique: ${index.unique ?? false}`
        );
    }


    const totalTickets =
        await Ticket.countDocuments();

    console.log(
        `\nTotal tickets: ${totalTickets}`
    );
}

try {
    await inspectTicketIndexes();
} catch (error) {
    console.error(
        "Index inspection failed:",
        error
    );

    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}