
import { API_BASE_URL, parseResponse } from './client'

export { ApiError } from './client'

export type AuthUser = {
    id: number
    name: string
    gmail: string
    role: string
}

export type LoginResponse = AuthUser & {
    access_token: string
    token_type: string
    session_id: number
    message: string
}

type TokenResponse = {
    access_token: string
    token_type: string
}

export async function login(
    gmail: string,
    password: string
): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gmail, password }),
    })

    return parseResponse<LoginResponse>(response)
}

export async function register(
    name: string,
    gmail: string,
    password: string
): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, gmail, password }),
    })

    return parseResponse<unknown>(response)
}

export async function refreshAccessToken(): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
    })

    const data = await parseResponse<TokenResponse>(response)
    return data.access_token
}

export async function getMyProfile(
    accessToken: string
): Promise<AuthUser> {
    const response = await fetch(`${API_BASE_URL}/me`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    })

    return parseResponse<AuthUser>(response)
}

export async function logout(
    accessToken: string
): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    })

    await parseResponse<unknown>(response)
}