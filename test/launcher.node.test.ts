import { afterEach, expect, it, vi } from 'vitest'

vi.mock('../src/utilities/platform', () => ({ ENVIRONMENT: 'node', PLATFORM: 'mac' }))
vi.mock('open', () => ({ openApp: vi.fn() }))

// Test files share a module cache (`isolate: false`), so reload the launcher to
// get its mocked dependencies and fresh launch counts
vi.resetModules()
const { openApp } = await import('open')
const { launchAnkiApp } = await import('../src/utilities/launcher')

afterEach(() => {
	vi.useRealTimers()
})

it('throttles launches and gives up after 100 per session', async () => {
	vi.useFakeTimers({ toFake: ['Date'] })

	for (let launch = 1; launch <= 100; launch++) {
		expect(await launchAnkiApp()).toBe(true)
		// Throttled, so this call doesn't open the app again
		expect(await launchAnkiApp()).toBe(true)
		expect(openApp).toHaveBeenCalledTimes(launch)
		vi.advanceTimersByTime(5001)
	}

	expect(await launchAnkiApp()).toBe(false)
	expect(openApp).toHaveBeenCalledTimes(100)
})
