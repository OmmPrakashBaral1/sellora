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
  type AuthUser,
} from '../api/auth'

import { AuthContext } from './auth-context'


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

    const getAccessToken = useCallback(async () => {
        if (tokenRef.current) return tokenRef.current

        if (!refreshPromiseRef.current) {
            const generation = generationRef.current

            const promise = refreshAccessToken().then((token) => {
                if (generation !== generationRef.current) {
                    throw new Error('Authentication state changed')
                }

                saveToken(token)
                return token
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
    }, [saveToken])

    useEffect(() => {
        let active = true

        async function restoreSession() {
            try {
                const token = await getAccessToken()

                if (!token) {
                    if (active) setUser(null)
                    return
                }

                const profile = await getMyProfile(token)

                if (active) setUser(profile)
            } catch {
                if (active) {
                    saveToken(null)
                    setUser(null)
                }
            } finally {
                if (active) setLoading(false)
            }
        }

        void restoreSession()

        return () => {
            active = false
        }
    }, [getAccessToken, saveToken])

    const login = useCallback(async (gmail: string, password: string) => {
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
        const token = await getAccessToken()

        if (!token) {
            throw new Error('No active session available for logout')
        }

        await apiLogout(token)

        generationRef.current += 1
        saveToken(null)
        setUser(null)
    }, [getAccessToken, saveToken])

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
