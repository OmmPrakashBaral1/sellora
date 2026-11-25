import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react'

import {
    login as apiLogin,
    logout as apiLogout,
    refreshAccessToken,
    getMyProfile,
    ApiError,
    type AuthUser,
} from '../api/auth'

import { AuthContext } from './auth-context'
import { isAccessTokenUsable } from '../utils/token'

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null)
    const [accessToken, setAccessToken] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    const tokenRef = useRef<string | null>(null)
    const refreshPromiseRef = useRef<Promise<string> | null>(null)
    const generationRef = useRef(0)

    const saveToken = useCallback((token: string | null) => {
        tokenRef.current = token
        setAccessToken(token)
    }, [])

    const clearSession = useCallback(() => {
        generationRef.current += 1
        saveToken(null)
        setUser(null)
    }, [saveToken])

    const getAccessToken = useCallback(async () => {
        const existingToken = tokenRef.current

        if (
            existingToken &&
            isAccessTokenUsable(existingToken)
        ) {
            return existingToken
        }

        if (!refreshPromiseRef.current) {
            const generation = generationRef.current

            const promise = refreshAccessToken()
                .then((token) => {
                    if (generation !== generationRef.current) {
                        throw new Error('Authentication state changed')
                    }

                    saveToken(token)
                    return token
                })
                .catch((error: unknown) => {
                    if (
                        generation === generationRef.current &&
                        error instanceof ApiError &&
                        error.status === 401
                    ) {
                        clearSession()
                    }

                    throw error
                })

            refreshPromiseRef.current = promise

            void promise.finally(() => {
                if (refreshPromiseRef.current === promise) {
                    refreshPromiseRef.current = null
                }
            }).catch(() => { })
        }

        try {
            return await refreshPromiseRef.current
        } catch {
            return null
        }
    }, [saveToken, clearSession])

    useEffect(() => {
        let active = true
        const generation = generationRef.current

        async function restoreSession() {
            try {
                const token = await getAccessToken()

                if (!token) return

                const profile = await getMyProfile(token)

                if (
                    active &&
                    generation === generationRef.current
                ) {
                    setUser(profile)
                }
            } catch {
                if (
                    active &&
                    generation === generationRef.current
                ) {
                    clearSession()
                }
            } finally {
                if (active) setLoading(false)
            }
        }

        void restoreSession()

        return () => {
            active = false
        }
    }, [getAccessToken, clearSession])

    const login = useCallback(async (
        gmail: string,
        password: string,
    ) => {
        if (refreshPromiseRef.current) {
            await refreshPromiseRef.current.catch(() => { })
        }

        const result = await apiLogin(gmail, password)

        generationRef.current += 1
        saveToken(result.access_token)

        setUser({
            id: result.id,
            name: result.name,
            gmail: result.gmail,
            role: result.role,
        })
    }, [saveToken])

    const logout = useCallback(async () => {
        const generation = generationRef.current
        const token = await getAccessToken()

        if (!token) {
            if (generation !== generationRef.current) {
                return
            }

            throw new Error(
                'Unable to verify your session. Please try again.',
            )
        }

        await apiLogout(token)
        clearSession()
    }, [getAccessToken, clearSession])

    return (
        <AuthContext.Provider
            value={{
                user,
                accessToken,
                loading,
                login,
                logout,
                getAccessToken,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}