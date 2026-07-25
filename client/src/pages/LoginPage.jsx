import { useState } from "react";
import {
    Link,
    useLocation,
    useNavigate,
} from "react-router";

import { useAuth } from "../auth/AuthContext.jsx";

export default function LoginPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { login } = useAuth();

    const [email, setEmail] = useState(
        location.state?.email || ""
    );

    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const registrationCompleted = Boolean(location.state?.registrationCompleted);

    async function handleSubmit(event) {
        event.preventDefault();

        setErrorMessage("");
        setFieldErrors({});
        setIsSubmitting(true);

        try {
            const session = await login({
                email,
                password,
            });

            const fallbackPath = session.memberships?.[0]?.workspace?.slug
                ? `/app/${session.memberships[0].workspace.slug}`
                : "/app";

            const destination = location.state?.from || fallbackPath;

            navigate(destination, {
                replace: true,
            });
        } catch (error) {
            const nextFieldErrors = {};

            for (const validationError of error.errors || []) {
                nextFieldErrors[validationError.field] =
                    validationError.messsage;
            }

            setFieldErrors(nextFieldErrors);
            setErrorMessage(error.messsage);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="auth-page">
            <section className="auth-card">
                <div className="brand-block">
                    <span className="brand-mark">A</span>

                    <div>
                        <strong>Alynt Support</strong>
                        <p>Multi-tenant customer support</p>
                    </div>
                </div>

                <header className="auth-header">
                    <h1>Welcome back</h1>
                    <p>Log in to access your support</p>
                </header>

                {registrationCompleted && (
                    <div className="alert alert-success">
                        Workspace registered successfully. Log in using your new account.
                    </div>
                )}

                {errorMessage && (
                    <div className="alert alert-success">
                        {errorMessage}
                    </div>
                )}

                <form
                    className="auth-form"
                    onSubmit={handleSubmit}
                    noValidate
                >
                    <label>
                        Email address
                        <input
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                            disabled={isSubmitting}
                        />

                        {fieldErrors.email && (
                            <span className="field-error">
                                {fieldErrors.email}
                            </span>
                        )}
                    </label>

                    <label>
                        Password
                        <input
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            disabled={isSubmitting}
                        />

                        {fieldErrors.password && (
                            <span className="field-error">
                                {fieldErrors.password}
                            </span>
                        )}
                    </label>

                    <button
                        className="button button-primary button-full"
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting
                            ? "Logging in..."
                            : "Log in"
                        }
                    </button>
                </form>

                <p className="auth-footer">
                    Creating a new company workspace? {" "}
                    <Link to="/register">
                        Register a workspace
                    </Link>
                </p>
            </section>
        </main>
    );
}