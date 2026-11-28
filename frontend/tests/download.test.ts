import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'

import { saveDownloadedFile } from '../src/utils/download'

const OBJECT_URL = 'blob:sellora-test-file'

const createObjectURLMock = vi.fn<
    (blob: Blob) => string
>(() => OBJECT_URL)

const revokeObjectURLMock = vi.fn<
    (url: string) => void
>(() => undefined)

const OriginalURL = globalThis.URL

beforeEach(() => {
    vi.useFakeTimers()

    createObjectURLMock.mockClear()
    revokeObjectURLMock.mockClear()

    class MockURL extends OriginalURL {
        static createObjectURL = createObjectURLMock
        static revokeObjectURL = revokeObjectURLMock
    }

    vi.stubGlobal('URL', MockURL)
})

afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

function createTestFile() {
    return {
        blob: new Blob(
            ['Sellora digital product'],
            { type: 'application/pdf' },
        ),
        filename: 'sellora-product-1.pdf',
    }
}

describe('Browser download utility', () => {
    it('creates an object URL from the supplied Blob', () => {
        vi.spyOn(
            HTMLAnchorElement.prototype,
            'click',
        ).mockImplementation(() => { })

        const file = createTestFile()

        saveDownloadedFile(file)

        expect(createObjectURLMock)
            .toHaveBeenCalledTimes(1)

        expect(createObjectURLMock)
            .toHaveBeenCalledWith(file.blob)
    })

    it('initiates a download with the expected URL and filename', () => {
        const file = createTestFile()

        const clickMock = vi.spyOn(
            HTMLAnchorElement.prototype,
            'click',
        ).mockImplementation(function (
            this: HTMLAnchorElement,
        ) {
            expect(this.href).toBe(OBJECT_URL)

            expect(this.download).toBe(file.filename)

            expect(document.body.contains(this))
                .toBe(true)
        })

        saveDownloadedFile(file)

        expect(clickMock).toHaveBeenCalledTimes(1)
    })

    it('removes the temporary anchor after initiating the download', () => {
        const removeMock = vi.spyOn(
            HTMLAnchorElement.prototype,
            'remove',
        )

        vi.spyOn(
            HTMLAnchorElement.prototype,
            'click',
        ).mockImplementation(() => { })

        saveDownloadedFile(createTestFile())

        expect(removeMock).toHaveBeenCalledTimes(1)

        expect(
            document.querySelector(
                `a[href="${OBJECT_URL}"]`,
            ),
        ).toBeNull()
    })

    it('does not revoke the object URL immediately', () => {
        vi.spyOn(
            HTMLAnchorElement.prototype,
            'click',
        ).mockImplementation(() => { })

        saveDownloadedFile(createTestFile())

        expect(revokeObjectURLMock)
            .not.toHaveBeenCalled()

        vi.advanceTimersByTime(999)

        expect(revokeObjectURLMock)
            .not.toHaveBeenCalled()
    })

    it('revokes the object URL after the cleanup delay', () => {
        vi.spyOn(
            HTMLAnchorElement.prototype,
            'click',
        ).mockImplementation(() => { })

        saveDownloadedFile(createTestFile())

        vi.advanceTimersByTime(1000)

        expect(revokeObjectURLMock)
            .toHaveBeenCalledTimes(1)

        expect(revokeObjectURLMock)
            .toHaveBeenCalledWith(OBJECT_URL)
    })

    it('cleans up resources even when download initiation fails', () => {
        const removeMock = vi.spyOn(
            HTMLAnchorElement.prototype,
            'remove',
        )

        vi.spyOn(
            HTMLAnchorElement.prototype,
            'click',
        ).mockImplementation(() => {
            throw new Error('Download initiation failed')
        })

        expect(() =>
            saveDownloadedFile(createTestFile()),
        ).toThrow('Download initiation failed')

        expect(removeMock).toHaveBeenCalledTimes(1)

        expect(
            document.querySelector(
                `a[href="${OBJECT_URL}"]`,
            ),
        ).toBeNull()

        vi.advanceTimersByTime(1000)

        expect(revokeObjectURLMock)
            .toHaveBeenCalledTimes(1)

        expect(revokeObjectURLMock)
            .toHaveBeenCalledWith(OBJECT_URL)
    })
})