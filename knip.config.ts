import { knipConfig } from '@kitschpatrol/knip-config'

export default knipConfig({
	ignoreBinaries: ['anki', 'awk', 'launchctl', 'open', 'osascript', 'pkill', 'taskkill'],
	ignoreDependencies: ['@kitschpatrol/typescript-config', 'playwright'],
})
