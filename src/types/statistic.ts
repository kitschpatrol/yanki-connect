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
			6,
			{
				deck: string
				startID: number
			},
			ReviewStatisticTuple[]
	  >
	| Request<'getCollectionStatsHTML', 6, { wholeCollection: boolean }, string>
	| Request<'getLatestReviewID', 6, { deck: string }, number>
	| Request<'getNumCardsReviewedByDay', 6, never, Array<[string, number]>>
	| Request<'getNumCardsReviewedToday', 6, never, number>
	| Request<
			'getReviewsOfCards',
			6,
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
	| Request<'insertReviews', 6, { reviews: ReviewStatisticTuple[] }>
