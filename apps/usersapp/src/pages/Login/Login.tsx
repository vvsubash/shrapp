import { useState } from "react";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "../../lib/auth-client";
import { authFormSchema, type AuthFormData } from "../../lib/schemas";
import "./Login.css";

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [serverError, setServerError] = useState("");
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormData>({
    resolver: zodResolver(authFormSchema),
  });

  function toggleMode() {
    setIsSignUp(!isSignUp);
    setServerError("");
    reset();
  }

  async function onSubmit(data: AuthFormData): Promise<void> {
    setServerError("");

    if (isSignUp && !data.email) {
      setServerError("Email is required for sign up");
      return;
    }

    try {
      if (isSignUp) {
        const { error } = await authClient.signUp.email({
          username: data.username,
          password: data.password,
          email: data.email!,
          name: data.username,
        });
        if (error) {
          setServerError(error.message ?? "Sign up failed");
          return;
        }
      } else {
        const { error } = await authClient.signIn.username({
          username: data.username,
          password: data.password,
        });
        if (error) {
          setServerError(error.message ?? "Sign in failed");
          return;
        }
      }
      navigate("/dashboard");
    } catch {
      setServerError("Something went wrong");
    }
  }

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={handleSubmit(onSubmit)}>
        <h2>{isSignUp ? "Sign Up" : "Sign In"}</h2>

        {serverError && <p className="login-error">{serverError}</p>}

        <label>
          Username
          <input
            type="text"
            autoComplete="username"
            aria-invalid={!!errors.username}
            {...register("username")}
          />
          {errors.username && (
            <span className="field-error">{errors.username.message}</span>
          )}
        </label>

        {isSignUp && (
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <span className="field-error">{errors.email.message}</span>
            )}
          </label>
        )}

        <label>
          Password
          <input
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password && (
            <span className="field-error">{errors.password.message}</span>
          )}
        </label>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Loading…" : isSignUp ? "Sign Up" : "Sign In"}
        </button>

        <p className="login-toggle">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button type="button" onClick={toggleMode}>
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </form>
    </div>
  );
}
