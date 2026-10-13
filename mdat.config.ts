import { mdatConfig } from '@kitschpatrol/mdat-config'
import { getYankiConnectMethodTree } from './scripts/list-actions'
import { getYankiConnectOptionsTable } from './scripts/list-options'

const actionTree = getYankiConnectMethodTree()

export default mdatConfig({
	actionCount() {
		return String(Object.values(actionTree).flat().length)
	},
	actionList() {
		const actionList = ['| Action | Minimum Anki | Minimum Anki-Connect |', '| --- | --- | --- |']

		for (const [group, actions] of Object.entries(actionTree)) {
			for (const action of actions) {
				actionList.push(
					`| \`client.${group}.${action.name}\` | ${action.minimumAnki} | ${action.minimumAnkiConnect} |`,
				)
			}
		}

		return actionList.join('\n')
	},
	optionsTable() {
		return getYankiConnectOptionsTable()
	},
})
