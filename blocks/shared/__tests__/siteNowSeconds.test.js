/**
 * "Now" on the editor's clock.
 *
 * The server sends two values: the moment the editor loaded as a true UTC
 * instant (`time()`), and the site clock's offset from UTC. Both are needed.
 * The anchor and the post date reach the browser as site-local strings with no
 * offset in them, and `siteTimeToSeconds()` parses those as if they were UTC so
 * that only differences are ever read. "Now" therefore has to be put on that
 * same clock, or a site whose clock is not UTC resolves a stage hours away from
 * the one the page renders — which is what happened when the server sent an
 * already shifted value and there was no offset to add.
 *
 * The last two assertions pin the consequence: five hours after an anchor, with
 * four-hour stages, the editor shows stage 2 — and stage 1 if the offset is
 * dropped.
 */

import {
	emptyStage,
	emptyTimeline,
	resolveTimeline,
	siteNowSeconds,
} from '../constants';

describe( 'the site clock in the editor bootstrap', () => {
	// 2026-10-28T10:00:00Z, and a site five and a half hours ahead of it.
	const NOW = Date.UTC( 2026, 9, 28, 10, 0, 0 ) / 1000;
	const OFFSET = 19800;

	it( 'adds the site offset to the server instant', () => {
		expect( siteNowSeconds( { now: NOW, nowOffset: OFFSET } ) ).toBe(
			NOW + OFFSET
		);
	} );

	it( 'leaves the server instant alone without an offset', () => {
		expect( siteNowSeconds( { now: NOW } ) ).toBe( NOW );
		expect( siteNowSeconds( { now: NOW, nowOffset: 0 } ) ).toBe( NOW );
		expect( siteNowSeconds( { now: NOW, nowOffset: 'abc' } ) ).toBe( NOW );
	} );

	it( 'keeps advancing with the drift since the bootstrap', () => {
		expect( siteNowSeconds( { now: NOW, nowOffset: OFFSET }, 2500 ) ).toBe(
			NOW + OFFSET + 2
		);

		// Both sides floor, so under a second has not been added yet.
		expect( siteNowSeconds( { now: NOW, nowOffset: OFFSET }, 999 ) ).toBe(
			NOW + OFFSET
		);
	} );

	it( 'falls back to the browser clock when the server sent none', () => {
		const local =
			Math.floor( Date.now() / 1000 ) -
			new Date().getTimezoneOffset() * 60;

		expect( Math.abs( siteNowSeconds( {} ) - local ) ).toBeLessThanOrEqual(
			1
		);
	} );
} );

describe( 'the stage that clock resolves', () => {
	const OFFSET = 19800;
	const ANCHOR = '2026-10-28 15:30:00';
	// How the browser reads a site-local string: as if it were UTC.
	const ANCHOR_ON_SITE_CLOCK = Date.parse( '2026-10-28T15:30:00Z' ) / 1000;
	// The same moment as the server sends it: a true UTC instant.
	const BOOT = { now: ANCHOR_ON_SITE_CLOCK - OFFSET, nowOffset: OFFSET };

	/**
	 * A two stage timeline, four hours each, starting at the anchor.
	 *
	 * @return {Object} Timeline.
	 */
	const timeline = () => {
		const value = emptyTimeline( {} );

		value.stage_1 = {
			...emptyStage( {} ),
			asset_id: 'first',
			duration: 4,
			unit: 'hours',
		};
		value.stage_2 = {
			...emptyStage( {} ),
			asset_id: 'second',
			duration: 4,
			unit: 'hours',
		};

		return value;
	};

	it( 'puts the server instant on the anchor’s clock', () => {
		expect( siteNowSeconds( BOOT ) ).toBe( ANCHOR_ON_SITE_CLOCK );
	} );

	it( 'resolves the stage the page would, five hours in', () => {
		const later = { ...BOOT, now: BOOT.now + 5 * 3600 };

		expect(
			resolveTimeline( timeline(), ANCHOR, siteNowSeconds( later ) ).stage
		).toBe( 2 );
	} );

	it( 'would be hours behind if the offset were dropped', () => {
		const later = { now: BOOT.now + 5 * 3600 };

		expect(
			resolveTimeline( timeline(), ANCHOR, siteNowSeconds( later ) ).stage
		).toBe( 1 );
	} );
} );
