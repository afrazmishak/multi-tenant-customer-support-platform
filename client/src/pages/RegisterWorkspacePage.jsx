import { useState } from "react";
import {
    Link,
    useNavigate,
} from "react-router";

import { useAuth } from "../auth/AuthContext.jsx";

const initialForm = {
    ownerName: "",
    ownerEmail: "",
    password: "",
    workspaceName: "",
    workspaceSlug: "",
};

export default function RegisterWorkspaceSlug() {
    const navigate = useNavigate();
    const { registerWorkspace } = useAuth();

    const [form, setForm] = useState(initialForm);
    const [errorMessage, setErrorMessage] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    function handleChange(event) {
        const { name, value } = event.target;

        setForm((currentForm) => ({
            ...currentForm,
            [name]: value,
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();

        setErrorMessage("");
        setFieldErrors({});
        setIsSubmitting(true);

        try {
            await registerWorkspace(form);

            navigate("/login", {
                replace: true,
                state: {
                    registrationCompleted: true,
                    email: form.ownerEmail,
                },
            });
        } catch (error) {
            const nextFieldErrors = {};

            for (const validationError of error.errors || []) {
                nextFieldErrors[validationError.field] = validationError.message;
            }

            setFieldErrors(nextFieldErrors);
            setErrorMessage(error.message);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="auth-page">
            <section className="auth-card auth-card-wide">
                <div className="brand-block">
                    <span className="brand-mark">A</span>

                    <div>
                        <strong>Alynt Support</strong>
                        <p>Multi-tenant customer support</p>
                    </div>
                </div>

                <header className="auht-header">
                    <h1>Create your workspace</h1>
                    <p>Register the company workspace and its first owner account.</p>
                </header>

                {errorMessage && (
                    <div className="alert alert-error">
                        {errorMessage}
                    </div>
                )}

                <form
                    className="auth-form"
                    onSubmit={handleSubmit}
                    noValidate
                >
                    <div className="form-grid">
                        <label>
                            Owner name
                            <input
                                name="ownerName"
                                type="text"
                                autoComplete="name"
                                value={form.ownerName}
                                onChange={handleChange}
                                disabled={isSubmitting}
                            />

                            {fieldErrors.ownerName && (
                                <span className="field-error">
                                    {fieldErrors.ownerName}
                                </span>
                            )}
                        </label>

                        <label>
                            Owner email
                            <input
                                name="ownerEmail"
                                type="text"
                                autoComplete="email"
                                value={form.ownerEmail}
                                onChange={handleChange}
                                disabled={isSubmitting}
                            />

                            {fieldErrors.ownerEmail && (
                                <span className="field-error">
                                    {fieldErrors.ownerEmail}
                                </span>
                            )}
                        </label>
                    </div>

                    <label>
                        Password
                        <input
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            value={form.password}
                            onChange={handleChange}
                            disabled={isSubmitting}
                        />

                        {fieldErrors.password && (
                            <span className="field-error">
                                {fieldErrors.password}
                            </span>
                        )}
                    </label>

                    <div />
                    <div className="form-grid">
                        <label>
                            Workspace name
                            <input
                                name="workspaceName"
                                type="text"
                                value={form.workspaceName}
                                onChange={handleChange}
                                disabled={isSubmitting}
                            />

                            {fieldErrors.workspaceName && (
                                <span className="field-error">
                                    {fieldErrors.workspaceName}
                                </span>
                            )}
                        </label>

                        <label>
                            Workspace URL
                            <input
                                name="workspaceSlug"
                                type="text"
                                placeholder="alynt-support"
                                value={form.workspaceSlug}
                                onChange={handleChange}
                                disabled={isSubmitting}
                            />

                            {fieldErrors.workspaceSlug && (
                                <span className="field-error">
                                    {fieldErrors.workspaceSlug}
                                </span>
                            )}
                        </label>
                    </div>

                    <button
                        className="button button-primary button-full"
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting
                            ? "Creating workspace..."
                            : "Create workspace"
                        }
                    </button>
                </form>

                <p className="auth-footer">
                    Already registered?{" "}
                    <Link to="/login">Log in</Link>
                </p>
            </section>
        </main>
    );
}