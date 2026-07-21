import mongoose, { mongo } from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
            minlength: [2, "Name must contain at least 2 characters"],
            maxlength: [100, "name cannot exceed 100 characters"],
        },

        email: {
            type: String,
            required: [true, "Email is required"],
            trim: true,
            lowercase: true,
            maxlength: [254, "Email address is too long"],
            match: [
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                "Please provide a valid email address",
            ],
        },

        passwordHash: {
            type: String,
            required: [true, "Password hash is required"],
            select: false,
        },

        status: {
            type: String,
            enum: {
                values: ["active", "disabled"],
                message: "Invalid user status: {VALUE}",
            },
            default: "active",
        },

        emailVerifiedAt: {
            type: Date,
            default: null
        },
    },
    {
        timestamps: true,
    }
);

userSchema.index(
    { email: 1 },
    {
        unique: true,
        name: "unique_user_email",
    }
);

const User = mongoose.model("User", userSchema);

export default User;