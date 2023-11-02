/* eslint-disable no-use-before-define */

// external
import withinRange from 'version-range'
import versionCompare from 'version-compare'
import { last } from '@bevry/list'

// related
import {
	NodeScheduleIdentifier,
	preloadNodeSchedule,
	getNodeScheduleIdentifiers,
	getNodeScheduleInformation,
	NodeScheduleInput,
	NodeScheduleInformation,
} from '@bevry/nodejs-schedule'
import {
	NodeReleaseInput,
	preloadNodeReleases,
	getNodeReleaseInformation,
	NodeReleaseIdentifier,
	getNodeReleaseIdentifiers,
} from '@bevry/nodejs-releases'

// ====================================
// API

/** Either a significant or absolute Node.js version number input */
export type NodeVersionInput = NodeScheduleInput | NodeReleaseInput

/** Either a significant or absolute Node.js version number */
export type NodeVersionIdentifier =
	| NodeScheduleIdentifier
	| NodeReleaseIdentifier

/** Helper method to detect if a version number is an absolute version number or not. */
export function isAbsoluteVersion(version: NodeVersionInput): boolean {
	return String(version).split('.').length === 3
}

/** Helper to return `false` if the Node.js version does not exist in the schedule (prior to 0.8, or say 0.9, or 0.11) */
export function getNodeScheduleInformationSafe(
	version: NodeScheduleInput,
): NodeScheduleInformation | false {
	if (
		versionCompare(version, '0.8') === -1 ||
		versionCompare(version, '0.9') === 0 ||
		versionCompare(version, '0.11') === 0
	) {
		return false
	}
	return getNodeScheduleInformation(version)
}

// prepare
let preloaded: boolean = false,
	nodeVersionLatestCurrent: NodeScheduleIdentifier,
	nodeVersionLatestActive: NodeScheduleIdentifier,
	nodeVersionLatestMaintenance: NodeScheduleIdentifier

/**
 * Fetch the metadata for the various Node.js releases from the official source.
 * https://github.com/nodejs/Release/pull/624
 */
export async function preloadNodeVersions(): Promise<void> {
	// preload
	await preloadNodeSchedule()
	await preloadNodeReleases()
	preloaded = true

	// helpers
	const nodeVersionsList = getNodeScheduleIdentifiers()
	nodeVersionLatestCurrent = last(nodeVersionsList.filter(isNodeVersionCurrent))
	nodeVersionLatestActive = last(nodeVersionsList.filter(isNodeVersionActive))
	nodeVersionLatestMaintenance = last(
		nodeVersionsList.filter(isNodeVersionMaintenance),
	)
}

// ====================================
// FILTERING

/**
 * The datetime that is used for comparisons.
 * Set to the current datetime at invocation, and can be updated via {@link datetime}.
 */
let now = new Date().getTime()

/**
 * Get or set the datetime that is compared against the times specified in the version metadata.
 * Used for testing and server purposes.
 */
export function datetime(when?: Date): number {
	if (when != null) now = when.getTime()
	return now
}

/** Is the version of these versions? */
export function isNodeVersionThese(
	version: NodeVersionInput,
	these: Array<NodeVersionInput>,
): boolean {
	return Boolean(these.find((seek) => versionCompare(version, seek) === 0))
}

/** Is the version within (inclusive) of these two versions? */
export function isNodeVersionBetween(
	version: NodeVersionInput,
	tuple: [gte: NodeVersionInput, lte: NodeVersionInput],
): boolean {
	return (
		versionCompare(version, tuple[0]) >= 0 &&
		versionCompare(version, tuple[1]) <= 0
	)
}

/**
 * Is the version the latest active LTS release?
 * Current > Active > Maintenance > EOL.
 * Uses the Node.js Schedule API to determine this.
 */
export function isNodeVersionLatestActive(version: NodeVersionInput): boolean {
	if (nodeVersionLatestActive == null)
		throw new Error(
			'You must await [preloadNodeVersions] prior to using the [isNodeVersionLatestActive] filter.',
		)
	return versionCompare(version, nodeVersionLatestActive) === 0
}

/**
 * Is the version the latest current release?
 * Current > Active > Maintenance > EOL.
 * Uses the Node.js Schedule API to determine this.
 */
export function isNodeVersionLatestCurrent(version: NodeVersionInput): boolean {
	if (nodeVersionLatestCurrent == null)
		throw new Error(
			'You must await [preloadNodeVersions] prior to using the [isNodeVersionLatestCurrent] filter.',
		)
	return versionCompare(version, nodeVersionLatestCurrent) === 0
}

/**
 * Is the version the latest maintenance release?
 * Current > Active > Maintenance > EOL.
 * Uses the Node.js Schedule API to determine this.
 */
export function isNodeVersionLatestMaintenance(
	version: NodeVersionInput,
): boolean {
	if (nodeVersionLatestMaintenance == null)
		throw new Error(
			'You must await [preloadNodeVersions] prior to using the [isNodeVersionLatestMaintenance] filter.',
		)
	return versionCompare(version, nodeVersionLatestMaintenance) === 0
}

/** Is the version lesser than or equal to the seek version? */
export function isNodeVersionLTE(
	version: NodeVersionInput,
	seek: NodeVersionInput,
): boolean {
	return versionCompare(version, seek) <= 0
}

/** Is the version greater than or equal to the seek version? */
export function isNodeVersionGTE(
	version: NodeVersionInput,
	seek: NodeVersionInput,
): boolean {
	return versionCompare(version, seek) >= 0
}

/** Is the version within this range? */
export function isNodeVersionWithinRange(
	version: NodeVersionInput,
	range: string,
): boolean {
	return withinRange(version, range)
}

/**
 * Is the version an active LTS release?
 * Active LTS - New features, bug fixes, and updates that have been audited by the LTS team and have been determined to be appropriate and stable for the release line.
 * Uses the Node.js Schedule and Release APIs to determine this.
 */
export function isNodeVersionActive(version: NodeVersionInput): boolean {
	if (preloaded === false)
		throw new Error(
			'You must await [preloadNodeVersions] prior to using the [isNodeVersionActive] filter.',
		)
	if (isAbsoluteVersion(version)) {
		const lts = getNodeReleaseInformation(version).lts
		if (typeof lts !== 'string') return false
	}
	const meta = getNodeScheduleInformationSafe(version)
	if (meta === false) return false
	const start = meta.lts
	const end = meta.maintenance || meta.end
	if (!start || !end) return false
	const active = now >= start.getTime() && now <= end.getTime()
	return active
}

/**
 * Is the version a active or current release?
 * That is to say it isn't in maintenance mode, or EOL.
 * Uses the Node.js Schedule API to determine this.
 */
export function isNodeVersionActiveOrCurrent(
	version: NodeScheduleInput,
): boolean {
	if (preloaded === false)
		throw new Error(
			'You must await [preloadNodeVersions] prior to using the [isNodeVersionActiveOrCurrent] filter.',
		)
	const meta = getNodeScheduleInformationSafe(version)
	if (meta === false) return false
	const start = meta.start
	const end = meta.maintenance || meta.end
	if (!start || !end) return false
	const activeOrCurrent = now >= start.getTime() && now <= end.getTime()
	return activeOrCurrent
}

/**
 * Has the version existed at some point?
 * Uses the Node.js Schedule and Release APIs to determine this.
 */
export function isNodeVersionReleased(version: NodeVersionInput): boolean {
	if (preloaded === false)
		throw new Error(
			'You must await [preloadNodeVersions] prior to using the [isNodeVersionReleased] filter.',
		)
	let date: Date
	if (isAbsoluteVersion(version)) {
		date = getNodeReleaseInformation(version).date
	} else {
		const meta = getNodeScheduleInformationSafe(version)
		if (meta === false) return false
		date = meta.start
	}
	if (!date) return false
	const released = now >= date.getTime()
	return released
}

/**
 * Is the version a current release?
 * Current - Should incorporate most of the non-major (non-breaking) changes that land on nodejs/node master branch.
 * Uses the Node.js Schedule and Release APIs to determine this.
 */
export function isNodeVersionCurrent(version: NodeScheduleInput): boolean {
	if (preloaded === false)
		throw new Error(
			'You must await [preloadNodeVersions] prior to using the [isNodeVersionCurrent] filter.',
		)
	const meta = getNodeScheduleInformationSafe(version)
	if (meta === false) return false
	const start = meta.start
	const end = meta.lts || meta.maintenance || meta.end
	if (!start || !end) return false
	const current = now >= start.getTime() && now <= end.getTime()
	return current
}

/** Does the version natively support ESM? */
export function isNodeVersionESM(version: NodeVersionInput): boolean {
	return versionCompare(version, '12') >= 0
}

/**
 * Is the version a LTS release? Tolerates unreleased versions.
 * To exclude unreleased versions, set `released` filter to `true`.
 * Includes the historical versions of 0.8, 0.10, and 0.12 (identified by no `lts` flag and no `maintenance` flag).
 * Uses the Node.js Schedule and Release APIs to determine this.
 */
export function isNodeVersionLTS(version: NodeVersionInput): boolean {
	if (preloaded === false)
		throw new Error(
			'You must await [preloadNodeVersions] prior to using the [isNodeVersionLTS] filter.',
		)
	if (isAbsoluteVersion(version) && versionCompare(version, '1') >= 0) {
		const lts = getNodeReleaseInformation(version).lts
		if (typeof lts !== 'string') return false
	}
	const meta = getNodeScheduleInformationSafe(version)
	if (meta === false) return false
	const lts = Boolean(meta.lts || !meta.maintenance)
	return lts
}

/**
 * Is the version currently maintained?
 * Current || Active || Maintenance
 * Uses the Node.js Schedule API to determine this.
 */
export function isNodeVersionMaintained(version: NodeScheduleInput): boolean {
	if (preloaded === false)
		throw new Error(
			'You must await [preloadNodeVersions] prior to using the [isNodeVersionMaintained] filter.',
		)
	const meta = getNodeScheduleInformationSafe(version)
	if (meta === false) return false
	const start = meta.start
	const end = meta.end
	if (!start || !end) return false
	const maintained = now >= start.getTime() && now <= end.getTime()
	return maintained
}

/**
 * Is the version a maintained release or a historical LTS release? Excludes unreleased versions.
 * Includes the historical versions of 0.8, 0.10, and 0.12 (identified by no `lts` flag and no `maintenance` flag).
 * Uses the Node.js Schedule API to determine this.
 */
export function isNodeVersionMaintainedOrLTS(
	version: NodeScheduleInput,
): boolean {
	if (preloaded === false)
		throw new Error(
			'You must await [preloadNodeVersions] prior to using the [isNodeVersionMaintainedOrLTS] filter.',
		)
	const meta = getNodeScheduleInformationSafe(version)
	if (meta === false) return false
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
 * Uses the Node.js Schedule API to determine this.
 */
export function isNodeVersionMaintenance(version: NodeScheduleInput): boolean {
	if (preloaded === false)
		throw new Error(
			'You must await [preloadNodeVersions] prior to using the [isNodeVersionMaintenance] filter.',
		)
	const meta = getNodeScheduleInformationSafe(version)
	if (meta === false) return false
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
export function isNodeVersionVercel(version: NodeVersionInput): boolean {
	return (
		versionCompare(version, '10') === 0 ||
		versionCompare(version, '12') === 0 ||
		versionCompare(version, '14') === 0
	)
}

/** The available filters to apply */
export interface Filters {
	/** @see isNodeVersionThese */
	these?: Array<NodeVersionInput>

	/** @see isNodeVersionBetween */
	between?: [gte: NodeVersionInput, lte: NodeVersionInput]

	/** @see isNodeVersionLTE */
	lte?: NodeVersionInput

	/** @see isNodeVersionGTE */
	gte?: NodeVersionInput

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
export function getNodeVersionStatus(version: NodeVersionInput) {
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
export function isNodeVersion(
	version: NodeVersionInput,
	filters: Filters,
): boolean {
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

/** Filter the supplied versions */
export function filterNodeVersions(
	versions: Array<NodeVersionIdentifier>,
	filters: Filters,
): Array<NodeVersionIdentifier> {
	return versions.filter((version) => isNodeVersion(version, filters))
}

/** Filter the significant Node.js versions */
export function filterSignificantNodeVersions(
	filters: Filters,
): Array<NodeVersionIdentifier> {
	if (preloaded === false)
		throw new Error(
			'You must await [preloadNodeVersions] prior to using [filterSignificantNodeVersions].',
		)
	return filterNodeVersions(getNodeScheduleIdentifiers(), filters)
}

/** Filter the absolute Node.js versions */
export function filterAbsoluteNodeVersions(
	filters: Filters,
): Array<NodeVersionIdentifier> {
	if (preloaded === false)
		throw new Error(
			'You must await [preloadNodeVersions] prior to using [filterAbsoluteNodeVersions].',
		)
	return filterNodeVersions(getNodeReleaseIdentifiers(), filters)
}
