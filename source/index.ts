/* eslint-disable no-use-before-define */

// external
import fetch from 'node-fetch'
import Errlop from 'errlop'
import withinRange from 'version-range'
import versionCompare from 'version-compare'
import { getDateWithYearOffset, getESVersion } from 'es-versions'
import { last } from '@bevry/list'
export { last } from '@bevry/list'

/** A version number in string or number format  */
export type Input = string | number

/** A version number in desired string format */
export type Key = string

/** The metadata for a version */
export interface Meta {
	version: string
	start: Date
	end: Date
	lts?: Date
	maintenance?: Date
	codename?: string
}

/** The response format from https://github.com/nodejs/Release */
interface Response {
	[version: string]: {
		start: string
		end: string
		lts?: string
		maintenance?: string
		codename?: string
	}
}

// prepare
const nodeVersionsMap = new Map<Key, Meta>()
const nodeVersionsList: Array<Key> = []
let nodeVersionLatestCurrent: Key,
	nodeVersionLatestActive: Key,
	nodeVersionLatestMaintenance: Key
const url =
	'https://raw.githubusercontent.com/nodejs/Release/master/schedule.json'

/**
 * The datetime that is used for comparisons.
 * Set to the current datetime at invocation, and can be updated via {@link datetime}.
 */
let now = new Date().getTime()

/**
 * Get or set the datetime that is compared against the times specified in the version metadata.
 * The only need to use this would be for testing or server purposes.
 */
export function datetime(when?: Date): number {
	if (when != null) now = when.getTime()
	return now
}

/**
 * Fetch the metadata for the various Node.js releases from the official source.
 * https://github.com/nodejs/Release/pull/624
 */
export async function fetchNodeVersions(): Promise<Array<Key>> {
	if (nodeVersionsMap.size) return nodeVersionsList
	try {
		// fetch node versions that have been released
		const response = await fetch(url, {})
		const json: Response = await response.json()
		for (const [key, meta] of Object.entries(json)) {
			const version = key.replace('v', '')
			const start = new Date(meta.start)
			const end = new Date(meta.end)
			let maintenance: Date | undefined, lts: Date | undefined
			if (meta.maintenance) maintenance = new Date(meta.maintenance)
			if (meta.lts) lts = new Date(meta.lts)
			nodeVersionsMap.set(version, {
				version,
				start,
				end,
				maintenance,
				lts,
				codename: meta.codename,
			})
		}
		nodeVersionsList.push(...Array.from(nodeVersionsMap.keys()))
		nodeVersionLatestCurrent = last(
			nodeVersionsList.filter(isNodeVersionCurrent)
		)
		nodeVersionLatestActive = last(nodeVersionsList.filter(isNodeVersionActive))
		nodeVersionLatestMaintenance = last(
			nodeVersionsList.filter(isNodeVersionMaintenance)
		)
		return nodeVersionsList
	} catch (err) {
		throw new Errlop(
			`Failed to fetch Node.js release schedule from ${url}`,
			err
		)
	}
}

/**
 * Get the release metadata for the version number.
 * Requires {@link fetchNodeVersions} to have been previously awaited.
 */
export function getNodeVersion(version: Input): Meta {
	const meta = nodeVersionsMap.get(String(version))
	if (!meta) {
		if (nodeVersionsMap.size)
			throw new Error(
				`Unable to get the Node.js version [${JSON.stringify(
					version
				)}] probably because the Node.js versions have not been fetched yet.`
			)
		else
			throw new Error(
				`Unable to find the Node.js version in the cache: ${JSON.stringify(
					version
				)}`
			)
	}
	return meta
}

/** Fetch the release metadata for the version number */
export async function fetchNodeVersion(version: Input): Promise<Meta> {
	await fetchNodeVersions()
	return getNodeVersion(version)
}

/** Is the version of these versions? */
export function isNodeVersionThese(
	version: Input,
	these: Array<Input>
): boolean {
	return Boolean(these.find((seek) => versionCompare(version, seek) === 0))
}

/** Is the version within (inclusive) of these two versions? */
export function isNodeVersionBetween(
	version: Input,
	tuple: [gte: Input, lte: Input]
): boolean {
	return (
		versionCompare(version, tuple[0]) >= 0 &&
		versionCompare(version, tuple[1]) <= 0
	)
}

/**
 * Is the version the latest active LTS release?
 * Current > Active > Maintenance > EOL
 */
export function isNodeVersionLatestActive(version: Input): boolean {
	return versionCompare(version, nodeVersionLatestActive) === 0
}

/**
 * Is the version the latest current release?
 * Current > Active > Maintenance > EOL
 */
export function isNodeVersionLatestCurrent(version: Input): boolean {
	return versionCompare(version, nodeVersionLatestCurrent) === 0
}

/**
 * Is the version the latest maintenance release?
 * Current > Active > Maintenance > EOL
 */
export function isNodeVersionLatestMaintenance(version: Input): boolean {
	return versionCompare(version, nodeVersionLatestMaintenance) === 0
}

/** Is the version lesser than or equal to the seek version? */
export function isNodeVersionLTE(version: Input, seek: Input): boolean {
	return versionCompare(version, seek) <= 0
}

/** Is the version greater than or equal to the seek version? */
export function isNodeVersionGTE(version: Input, seek: Input): boolean {
	return versionCompare(version, seek) >= 0
}

/** Is the version within this range? */
export function isNodeVersionWithinRange(
	version: Input,
	range: string
): boolean {
	return withinRange(version, range)
}

/**
 * Is the version an active LTS release?
 * Active LTS - New features, bug fixes, and updates that have been audited by the LTS team and have been determined to be appropriate and stable for the release line.
 */
export function isNodeVersionActive(version: Input): boolean {
	const meta = getNodeVersion(version)
	const start = meta.lts
	const end = meta.maintenance || meta.end
	if (!start || !end) return false
	const active = now >= start.getTime() && now <= end.getTime()
	return active
}

/**
 * Is the version a active or current release?
 * That is to say it isn't in maintenance mode, or EOL.
 */
export function isNodeVersionActiveOrCurrent(version: Input): boolean {
	const meta = getNodeVersion(version)
	const start = meta.start
	const end = meta.maintenance || meta.end
	if (!start || !end) return false
	const activeOrCurrent = now >= start.getTime() && now <= end.getTime()
	return activeOrCurrent
}

/** Has the version existed at some point? */
export function isNodeVersionReleased(version: Input): boolean {
	const meta = getNodeVersion(version)
	const start = meta.start
	if (!start) return false
	const released = now >= start.getTime()
	return released
}

/**
 * Is the version a current release?
 * Current - Should incorporate most of the non-major (non-breaking) changes that land on nodejs/node master branch.
 */
export function isNodeVersionCurrent(version: Input): boolean {
	const meta = getNodeVersion(version)
	const start = meta.start
	const end = meta.lts || meta.maintenance || meta.end
	if (!start || !end) return false
	const current = now >= start.getTime() && now <= end.getTime()
	return current
}

/** Does the version natively support ESM? */
export function isNodeVersionESM(version: Input): boolean {
	return versionCompare(version, '12') >= 0
}

/**
 * Is the version a LTS release? Tolerates unreleased versions.
 * To exclude unreleased versions, set `released` filter to `true`.
 * Includes the historical versions of 0.8, 0.10, and 0.12 (identified by no `lts` flag and no `maintenance` flag).
 */
export function isNodeVersionLTS(version: Input): boolean {
	const meta = getNodeVersion(version)
	const lts = Boolean(meta.lts || !meta.maintenance)
	return lts
}

/**
 * Is the version currently maintained?
 * Current || Active || Maintenance
 */
export function isNodeVersionMaintained(version: Input): boolean {
	const meta = getNodeVersion(version)
	const start = meta.start
	const end = meta.end
	if (!start || !end) return false
	const maintained = now >= start.getTime() && now <= end.getTime()
	return maintained
}

/**
 * Is the version a maintained release or a historical LTS release? Excludes unreleased versions.
 * Includes the historical versions of 0.8, 0.10, and 0.12 (identified by no `lts` flag and no `maintenance` flag).
 */
export function isNodeVersionMaintainedOrLTS(version: Input): boolean {
	const meta = getNodeVersion(version)
	const start = meta.start
	const end = meta.end
	if (!start || !end) return false
	const released = now >= start.getTime()
	if (!released) return false
	const maintained = now <= end.getTime()
	if (maintained) return true
	const lts = Boolean(meta.lts || !meta.maintenance)
	return lts
}

/**
 * Is the version a maintenance release?
 * Maintenance - Critical bug fixes and security updates. New features may be added at the discretion of the LTS team - typically only in cases where the new feature supports migration to later release lines.
 */
export function isNodeVersionMaintenance(version: Input): boolean {
	const meta = getNodeVersion(version)
	const start = meta.maintenance
	const end = meta.end
	if (!start || !end) return false
	const maintenance = now >= start.getTime() && now <= end.getTime()
	return maintenance
}

/**
 * Is the node version compatible with vercel?
 * https://vercel.com/docs/serverless-functions/supported-languages?query=node%20version#defined-node.js-version
 * https://vercel.com/docs/runtimes#official-runtimes/node-js/node-js-version
 */
export function isNodeVersionVercel(version: Input): boolean {
	return (
		versionCompare(version, '10') === 0 || versionCompare(version, '12') === 0
	)
}

/** The available filters to apply */
export interface Filters {
	/** @see isNodeVersionThese */
	these?: Array<Input>

	/** @see isNodeVersionBetween */
	between?: [gte: Input, lte: Input]

	/** @see isNodeVersionLTE */
	lte?: Input

	/** @see isNodeVersionGTE */
	gte?: Input

	/** @see isNodeVersionWithinRange */
	range?: string

	/** @see isNodeVersionActive */
	active?: boolean

	/** @see isNodeVersionActiveOrCurrent */
	activeOrCurrent?: boolean

	/** @see isNodeVersionCurrent */
	current?: boolean

	/** @see isNodeVersionESM */
	esm?: boolean

	/** @see isNodeVersionLatestActive */
	latestActive?: boolean

	/** @see isNodeVersionLatestCurrent */
	latestCurrent?: boolean

	/** @see isNodeVersionLatestMaintenance */
	latestMaintenance?: boolean

	/** @see isNodeVersionLTS */
	lts?: boolean

	/** @see isNodeVersionMaintained */
	maintained?: boolean

	/** @see isNodeVersionMaintainedOrLTS */
	maintainedOrLTS?: boolean

	/** @see isNodeVersionMaintenance */
	maintenance?: boolean

	/** @see isNodeVersionReleased */
	released?: boolean

	/** @see isNodeVersionVercel */
	vercel?: boolean
}

/** Get the status of the node version? */
export function getNodeVersionStatus(version: Input) {
	return {
		active: isNodeVersionActive(version),
		activeOrCurrent: isNodeVersionActiveOrCurrent(version),
		current: isNodeVersionCurrent(version),
		esm: isNodeVersionESM(version),
		latestActive: isNodeVersionLatestActive(version),
		latestCurrent: isNodeVersionLatestCurrent(version),
		latestMaintenance: isNodeVersionLatestMaintenance(version),
		lts: isNodeVersionLTS(version),
		maintained: isNodeVersionMaintained(version),
		maintainedOrLTS: isNodeVersionMaintainedOrLTS(version),
		maintenance: isNodeVersionMaintenance(version),
		released: isNodeVersionReleased(version),
		vercel: isNodeVersionVercel(version),
	}
}

/** Is the node version compatible with these filters? */
export function isNodeVersion(version: Input, filters: Filters): boolean {
	// with params
	if (filters.these && !isNodeVersionThese(version, filters.these)) return false
	if (filters.between && !isNodeVersionBetween(version, filters.between))
		return false
	if (filters.lte && !isNodeVersionLTE(version, filters.lte)) return false
	if (filters.gte && !isNodeVersionGTE(version, filters.gte)) return false
	if (filters.range && !isNodeVersionWithinRange(version, filters.range))
		return false

	// without params
	if (filters.active && !isNodeVersionActive(version)) return false
	if (filters.activeOrCurrent && !isNodeVersionActiveOrCurrent(version))
		return false
	if (filters.current && !isNodeVersionCurrent(version)) return false
	if (filters.esm && !isNodeVersionESM(version)) return false
	if (filters.latestActive && !isNodeVersionLatestActive(version)) return false
	if (filters.latestCurrent && !isNodeVersionLatestCurrent(version))
		return false
	if (filters.latestMaintenance && !isNodeVersionLatestMaintenance(version))
		return false
	if (filters.lts && !isNodeVersionLTS(version)) return false
	if (filters.maintained && !isNodeVersionMaintained(version)) return false
	if (filters.maintainedOrLTS && !isNodeVersionMaintainedOrLTS(version))
		return false
	if (filters.maintenance && !isNodeVersionMaintenance(version)) return false
	if (filters.released && !isNodeVersionReleased(version)) return false
	if (filters.vercel && !isNodeVersionVercel(version)) return false
	return true
}

/** Filter the versions */
export function filterNodeVersions(
	versions: Array<Key>,
	filters: Filters
): Array<Key> {
	return versions.filter((version) => isNodeVersion(version, filters))
}

/** Fetch and then filter the versions */
export async function fetchAndFilterNodeVersions(filters: Filters) {
	await fetchNodeVersions()
	return filterNodeVersions(nodeVersionsList, filters)
}

/** Fetch the ratified ECMAScript version at the time of a Node.js version release. */
export async function fetchESVersionForNodeVersion(
	nodeVersion: Input
): Promise<string> {
	const meta = await fetchNodeVersion(nodeVersion)
	return getESVersion(meta.start)
}

/** Get the ratified ECMAScript version at the time of a Node.js version release. */
export function getESVersionForNodeVersion(nodeVersion: Input): string {
	const meta = getNodeVersion(nodeVersion)
	return getESVersion(meta.start)
}

/**
 * For each provided Node.js version, fetch its ECMAScript version, and return the list without duplicates.
 * @returns ECMAScript versions sorted from oldest to newest.
 */
export async function fetchESVersionsForNodeVersions(
	nodeVersions: Array<Input>
): Promise<Array<string>> {
	const versions = new Set<string>()
	for (const nodeVersion of nodeVersions.sort(versionCompare)) {
		versions.add(await fetchESVersionForNodeVersion(nodeVersion))
	}
	return Array.from(versions.values())
}

/**
 * For each provided Node.js version, fetch its ECMAScript version, and return the list without duplicates.
 * @returns ECMAScript versions sorted from oldest to newest.
 */
export function getESVersionsForNodeVersions(
	nodeVersions: Array<Input>
): Array<string> {
	const versions = new Set<string>()
	for (const nodeVersion of nodeVersions.sort(versionCompare)) {
		versions.add(getESVersionForNodeVersion(nodeVersion))
	}
	return Array.from(versions.values())
}
