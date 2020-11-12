import { deepEqual, equal } from 'assert-helpers'
import kava from 'kava'
import versionCompare from 'version-compare'

import {
	isNodeVersion,
	datetime,
	Filters,
	fetchNodeVersions,
	getNodeVersionStatus,
	filterNodeVersions,
	getESVersionsForNodeVersions,
} from './index.js'

// set a consistent datetime
datetime(new Date('2020-11-03'))

const fixtures: { [key: string]: Filters } = {
	'0.8': {
		active: false,
		activeOrCurrent: false,
		current: false,
		esm: false,
		latestActive: false,
		latestCurrent: false,
		latestMaintenance: false,
		lts: true,
		maintained: false,
		maintainedOrLTS: true,
		maintenance: false,
		released: true,
		vercel: false,
	},
	'0.10': {
		active: false,
		activeOrCurrent: false,
		current: false,
		esm: false,
		latestActive: false,
		latestCurrent: false,
		latestMaintenance: false,
		lts: true,
		maintained: false,
		maintainedOrLTS: true,
		maintenance: false,
		released: true,
		vercel: false,
	},
	'0.12': {
		active: false,
		activeOrCurrent: false,
		current: false,
		esm: false,
		latestActive: false,
		latestCurrent: false,
		latestMaintenance: false,
		lts: true,
		maintained: false,
		maintainedOrLTS: true,
		maintenance: false,
		released: true,
		vercel: false,
	},
	'4': {
		active: false,
		activeOrCurrent: false,
		current: false,
		esm: false,
		latestActive: false,
		latestCurrent: false,
		latestMaintenance: false,
		lts: true,
		maintained: false,
		maintainedOrLTS: true,
		maintenance: false,
		released: true,
		vercel: false,
	},
	'8': {
		active: false,
		activeOrCurrent: false,
		current: false,
		esm: false,
		latestActive: false,
		latestCurrent: false,
		latestMaintenance: false,
		lts: true,
		maintained: false,
		maintainedOrLTS: true,
		maintenance: false,
		released: true,
		vercel: false,
	},
	'10': {
		active: false,
		activeOrCurrent: false,
		current: false,
		esm: false,
		latestActive: false,
		latestCurrent: false,
		latestMaintenance: true,
		lts: true,
		maintained: true,
		maintainedOrLTS: true,
		maintenance: true,
		released: true,
		vercel: true,
	},
	'12': {
		active: true,
		activeOrCurrent: true,
		current: false,
		esm: true,
		latestActive: false,
		latestCurrent: false,
		latestMaintenance: false,
		lts: true,
		maintained: true,
		maintainedOrLTS: true,
		maintenance: false,
		released: true,
		vercel: true,
	},
	'13': {
		active: false,
		activeOrCurrent: false,
		current: false,
		esm: true,
		latestActive: false,
		latestCurrent: false,
		latestMaintenance: false,
		lts: false,
		maintained: false,
		maintainedOrLTS: false,
		maintenance: false,
		released: true,
		vercel: false,
	},
	'14': {
		active: true,
		activeOrCurrent: true,
		current: false,
		esm: true,
		latestActive: true,
		latestCurrent: false,
		latestMaintenance: false,
		lts: true,
		maintained: true,
		maintainedOrLTS: true,
		maintenance: false,
		released: true,
		vercel: false,
	},
	'15': {
		active: false,
		activeOrCurrent: true,
		current: true,
		esm: true,
		latestActive: false,
		latestCurrent: true,
		latestMaintenance: false,
		lts: false,
		maintained: true,
		maintainedOrLTS: true,
		maintenance: false,
		released: true,
		vercel: false,
	},
	'16': {
		active: false,
		activeOrCurrent: false,
		current: false,
		esm: true,
		latestActive: false,
		latestCurrent: false,
		latestMaintenance: false,
		lts: true,
		maintained: false,
		maintainedOrLTS: false,
		maintenance: false,
		released: false,
		vercel: false,
	},
}

/** Flags to versions */
const results: { [flag: string]: Array<string> } = {}

// nv.isNodeVersionWithinRange
// nv.isNodeVersionGTE
// nv.isNodeVersionLTE
// nv.isNodeVersionThese

kava.suite('@bevry/node-versions', function (suite, test) {
	const fixtureVersions = Object.keys(fixtures).sort(versionCompare)
	let remoteVersions: Array<string>
	test('fetch', function (done) {
		fetchNodeVersions()
			.then((versions) => {
				remoteVersions = versions
				done()
			})
			.catch(done)
	})
	suite('individual filtering', function (suite, test) {
		for (const version of fixtureVersions) {
			test(version, function () {
				// get flags
				const actual = getNodeVersionStatus(version)
				// log for the user
				// eslint-disable-next-line no-console
				console.log(version, actual)
				deepEqual(actual, fixtures[version], 'status was as expected')
				for (const [flag, result] of Object.entries(actual)) {
					if (!results[flag]) results[flag] = []
					equal(
						isNodeVersion(version, { [flag]: true }),
						result,
						`${version} ${flag} was expected to be ${result}`
					)
					if (result) {
						results[flag].push(version)
					}
				}
			})
		}
	})
	test('collective versions', function () {
		for (const [flag, expected] of Object.entries(results)) {
			const actual = filterNodeVersions(fixtureVersions, { [flag]: true })
			equal(
				actual.join(', '),
				expected.join(', '),
				`${flag} results were as expected`
			)
			// log for the user
			// eslint-disable-next-line no-console
			console.log(flag, actual)
		}
	})
	test('these', function () {
		const expected = ['4', '8']
		const actual = filterNodeVersions(remoteVersions, { these: ['4', '8'] })
		equal(actual.join(', '), expected.join(', '))
	})
	test('between', function () {
		const expected = ['4', '5', '6', '7', '8']
		const actual = filterNodeVersions(remoteVersions, { between: ['4', '8'] })
		equal(actual.join(', '), expected.join(', '))
	})
	test('lte', function () {
		const expected = ['0.8', '0.10', '0.12', '4']
		const actual = filterNodeVersions(remoteVersions, { lte: '4' })
		equal(actual.join(', '), expected.join(', '))
	})
	test('gte+lte', function () {
		const expected = ['0.12', '4']
		const actual = filterNodeVersions(remoteVersions, { lte: '4', gte: '0.12' })
		equal(actual.join(', '), expected.join(', '))
	})
	test('range', function () {
		const expected = ['0.8', '0.10', '0.12']
		const actual = filterNodeVersions(remoteVersions, { range: '<4' })
		equal(actual.join(', '), expected.join(', '))
	})
	test('es-versions', function () {
		const expected = ['ES2019', 'ES2020']
		const actual = getESVersionsForNodeVersions(['15', '14', '13'])
		equal(actual.join(', '), expected.join(', '))
	})
})
