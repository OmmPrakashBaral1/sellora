
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'

import { register } from '../api/auth'
import { useAuth } from '../context/useAuth'

export default function RegisterPage() {
    const { user, loading } = useAuth()
    const navigate = useNavigate()

    const [name, setName] = useState('')
    const [gmail, setGmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    if (loading) {
        return <main className="p-8 text-center">Loading...</main>
    }

    if (user) {
        return <Navigate to="/" replace />
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError('')

        if (password !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        setSubmitting(true)

        try {
            await register(name.trim(), gmail.trim(), password)
            navigate('/login', { replace: true })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <main className="mx-auto max-w-md px-4 py-16">
            <h1 className="mb-3 text-3xl font-bold">Create your account</h1>
            <p className="mb-8 text-muted">
                Join Sellora to discover digital products.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="name" className="mb-2 block font-medium">
                        Full name
                    </label>
                    <input
                        id="name"
                        required
                        maxLength={100}
                        autoComplete="name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="w-full rounded-lg border border-outline bg-surface px-4 py-3"
                    />
                </div>

                <div>
                    <label htmlFor="gmail" className="mb-2 block font-medium">
                        Email
                    </label>
                    <input
                        id="gmail"
                        type="email"
                        required
                        autoComplete="email"
                        value={gmail}
                        onChange={(event) => setGmail(event.target.value)}
                        className="w-full rounded-lg border border-outline bg-surface px-4 py-3"
                    />
                </div>

                <div>
                    <label htmlFor="password" className="mb-2 block font-medium">
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="w-full rounded-lg border border-outline bg-surface px-4 py-3"
                    />
                </div>

                <div>
                    <label htmlFor="confirm-password" className="mb-2 block font-medium">
                        Confirm password
                    </label>
                    <input
                        id="confirm-password"
                        type="password"
                        required
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className="w-full rounded-lg border border-outline bg-surface px-4 py-3"
                    />
                </div>

                {error && (
                    <p role="alert" className="text-sm text-red-500">
                        {error}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-lg bg-brand px-5 py-3 font-semibold text-white disabled:opacity-50"
                >
                    {submitting ? 'Creating account...' : 'Create account'}
                </button>
            </form>

            <p className="mt-6 text-center text-sm">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-brand underline">
                    Sign in
                </Link>
            </p>
        </main>
    )
}