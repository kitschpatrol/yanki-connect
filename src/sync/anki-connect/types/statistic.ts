import { type Request } from './shared'

export type ReviewStatisticTuple = [
	reviewTime: number,
	cardID: number,
	usn: number,
	buttonPressed: number,
	newInterval: number,
	previousInterval: number,
	newFactor: number,
	reviewDuration: number,
	reviewType: number,
]

export type StatisticRequests =
	| Request<
			'cardReviews',
			{
				deck: string
				startID: number
			},
			ReviewStatisticTuple[]
	  >
	| Request<
			'getReviewsOfCards',
			{
				cards: string[]
			},
			Record<
				string,
				Array<{
					/** ButtonPressed */
					ease: number
					/** NewFactor */
					factor: number
					/** ReviewTime */
					id: number
					/** NewInterval */
					ivl: number
					/** PreviousInterval */
					lastIvl: number
					/** ReviewDuration */
					time: number
					/** ReviewType */
					type: number
					/** Usn */
					usn: number
				}>
			>
	  >
	| Request<'getCollectionStatsHTML', { wholeCollection: boolean }, string>
	| Request<'getLatestReviewID', { deck: string }, number>
	| Request<'getNumCardsReviewedByDay', never, Array<[string, number]>>
	| Request<'getNumCardsReviewedToday', never, number>
	| Request<'insertReviews', { reviews: ReviewStatisticTuple[] }>
