/**
 * The Guide tab and the settings help card.
 *
 * The Guide is where the explanations the editor no longer carries ended up, so
 * the two things worth checking are that the sections are really rendered and
 * that its links point where they claim: back to the settings tab, and the help
 * card at the Guide.
 *
 * The admin components import through the webpack alias (`@titlesparks/shared/*`,
 * see webpack.config.js), which jest is not configured with, so those specifiers
 * are mapped to the same files the bundle uses.
 */

import { createRoot } from '@wordpress/element';
import { act } from 'react';

import Guide from '../Guide';
import InfoCards from '../InfoCards';

jest.mock( '@titlesparks/shared/ui', () => require( '../../shared/ui' ), {
	virtual: true,
} );
jest.mock( '@titlesparks/shared/icons', () => require( '../../shared/icons' ), {
	virtual: true,
} );

jest.mock( '@wordpress/i18n', () => ( {
	__: ( text ) => text,
	sprintf: ( format, ...args ) =>
		args.reduce(
			( text, value, index ) =>
				text.replace( new RegExp( `%${ index + 1 }\\$s|%s` ), value ),
			format
		),
} ) );

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Render a component and hand back its container.
 *
 * @param {JSX.Element} element Component.
 * @return {Object} Container and an unmount.
 */
const render = ( element ) => {
	const container = document.createElement( 'div' );

	document.body.appendChild( container );

	const root = createRoot( container );

	act( () => root.render( element ) );

	return {
		container,
		unmount: () => act( () => root.unmount() ),
	};
};

afterEach( () => {
	document.body.innerHTML = '';
} );

describe( 'the Guide', () => {
	it( 'renders every section the editor no longer explains', () => {
		const { container, unmount } = render(
			<Guide settingsUrl="https://example.test/admin.php?page=titlesparks#settings" />
		);

		[
			'Stages',
			'Where a timeline starts',
			'Position',
			'Editor and your site',
			'An icon inside a card',
			'Size',
			'Assets',
			'Defaults',
		].forEach( ( heading ) => {
			expect( container.textContent ).toContain( heading );
		} );

		// The two rules that were longest in the sidebar are the ones worth
		// knowing travelled here.
		expect( container.textContent ).toContain( 'Clear the End field' );
		expect( container.textContent ).toContain( 'Offset is space' );

		// Mirroring is a per-stage choice, not a library edit.
		expect( container.textContent ).toContain( 'Facing the other way' );
		expect( container.textContent ).toContain( 'Flip horizontally' );

		// How resizing behaves is a rule a reader would otherwise have to infer
		// from the canvas.
		expect( container.textContent ).toContain( 'Resizing keeps its place' );

		// The answer to "why does it look different on my site": the placement
		// is measured from the real title, so a theme's font cannot move it.
		expect( container.textContent ).toContain( 'Measured, not assumed' );
		expect( container.textContent ).toContain(
			'Offsets grow with the title'
		);

		// "What do I attach here" is answered by naming where the artwork comes
		// from, beside the route that uploads it.
		expect( container.textContent ).toContain( 'Pixabay' );

		// A widget icon cannot use the page's space beside it, so the Guide says
		// what the tight-card switch does both ways — and that the answer is a
		// smaller icon rather than a narrower title.
		expect( container.textContent ).toContain(
			'Cards have no room to give'
		);
		expect( container.textContent ).toContain(
			'Off leaves the icon exactly as it is'
		);
		expect( container.textContent ).toContain(
			'On fits the icon inside the card'
		);
		expect( container.textContent ).toContain( 'drawn smaller' );
		expect( container.textContent ).toContain( 'never indented' );
		expect( container.textContent ).not.toContain(
			'Wrap the title to make room'
		);
		expect( container.textContent ).not.toContain( 'Hide the icon' );

		// The rule the author could not see: a wrapped title keeps the icon on
		// the line it was placed on, and where to change that.
		expect( container.textContent ).toContain( 'Titles that wrap' );
		expect( container.textContent ).toContain(
			'anchored to the first line'
		);
		expect( container.textContent ).toContain( 'Icon lines up with' );

		// The icon is positioned already, so the setting that decides its
		// stacking order is only needed when a theme stacks over the heading.
		expect( container.textContent ).toContain(
			'In front of your theme’s layers'
		);
		expect( container.textContent ).toContain( 'Icon stacking order' );

		unmount();
	} );

	it( 'links back to the settings tab', () => {
		const { container, unmount } = render(
			<Guide settingsUrl="https://example.test/admin.php?page=titlesparks#settings" />
		);
		const back = container.querySelector( 'a' );

		expect( back.getAttribute( 'href' ) ).toBe(
			'https://example.test/admin.php?page=titlesparks#settings'
		);

		unmount();
	} );

	it( 'renders without a settings page to link to', () => {
		const { container, unmount } = render( <Guide settingsUrl="" /> );

		expect( container.querySelector( 'a' ) ).toBeNull();
		expect( container.textContent ).toContain( 'How it works' );

		unmount();
	} );
} );

describe( 'the settings help card', () => {
	it( 'points at the Guide', () => {
		const { container, unmount } = render(
			<InfoCards guideUrl="#guide" />
		);
		const link = container.querySelector( 'a' );

		expect( link.getAttribute( 'href' ) ).toBe( '#guide' );
		expect( container.textContent ).toContain( 'Open the Guide' );

		unmount();
	} );

	it( 'leaves the link out when there is no Guide to open', () => {
		const { container, unmount } = render( <InfoCards /> );

		expect( container.querySelector( 'a' ) ).toBeNull();
		expect( container.textContent ).toContain( 'How It Works' );

		unmount();
	} );
} );
