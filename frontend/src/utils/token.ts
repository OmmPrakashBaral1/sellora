export function isAccessTokenUsable(
    token: string,
    bufferSeconds = 30,
): boolean {
    try {
        const parts = token.split('.')

        if (parts.length !== 3) return false

        const base64 = parts[1]
            .replace(/-/g, '+')
            .replace(/_/g, '/')

        const padded = base64.padEnd(
            Math.ceil(base64.length / 4) * 4,
            '=',
        )

        const payload = JSON.parse(atob(padded))

        if (
            typeof payload.exp !== 'number' ||
            !Number.isFinite(payload.exp)
        ) {
            return false
        }

        const currentTime = Date.now() / 1000

        return payload.exp > currentTime + bufferSeconds
    } catch {
        return false
    }
}