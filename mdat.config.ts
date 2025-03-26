import { mdatConfig } from '@kitschpatrol/mdat-config'
import { getYankiConnectMethodTree } from './scripts/list-actions'

const actionTree = getYankiConnectMethodTree()

export default mdatConfig({
	rules: {
		actionCount() {
			return String(Object.values(actionTree).flat().length)
		},
		actionList() {
			const actionList: string[] = []

			for (const [group, actions] of Object.entries(actionTree)) {
				for (const action of actions) {
					actionList.push(`client.${group}.${action}`)
				}
				actionList.push('')
			}

			return `\`\`\`ts\n${actionList.join('\n')}\`\`\`\n`
		},
	},
})
