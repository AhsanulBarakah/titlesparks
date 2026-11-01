/**
 * A grid thumbnail: the still frame now, the animation when the browser is idle.
 *
 * The whole point is the order — the card must be complete before the original
 * is requested — so what is checked here is which source is drawn first, and
 * that the original does arrive afterwards rather than never. A file with no
 * smaller copy draws as itself from the start.
 */

import { createRoot } from '@wordpress/element';
import { act } from 'react';

import { useDeferredPreview } from '../useDeferredPreview';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const Thumb = ( { preview, original } ) => (
	<img
		src={ useDeferredPreview( preview, original ) }
		alt="preview"
		data-testid="thumb"
	/>
);

const mount = ( props ) => {
	const container = document.createElement( 'div' );

	document.body.appendChild( container );

	const root = createRoot( container );

	act( () => {
		root.render( <Thumb { ...props } /> );
	} );

	return { container, root };
};

const srcOf = ( container ) => container.querySelector( 'img' ).src;

beforeEach( () => {
	document.body.innerHTML = '';
	jest.useFakeTimers();
} );

afterEach( () => {
	jest.useRealTimers();
} );

it( 'draws the still copy first and the original afterwards', async () => {
	const { container, root } = mount( {
		preview: 'https://example.test/flag-300x300.gif',
		original: 'https://example.test/flag.gif',
	} );

	expect( srcOf( container ) ).toBe(
		'https://example.test/flag-300x300.gif'
	);

	await act( async () => {
		jest.advanceTimersByTime( 5000 );
	} );

	expect( srcOf( container ) ).toBe( 'https://example.test/flag.gif' );

	act( () => {
		root.unmount();
	} );
} );

it( 'draws the original straight away when there is no smaller copy', async () => {
	const { container, root } = mount( {
		preview: '',
		original: 'https://example.test/icon.svg',
	} );

	expect( srcOf( container ) ).toBe( 'https://example.test/icon.svg' );

	await act( async () => {
		jest.advanceTimersByTime( 5000 );
	} );

	expect( srcOf( container ) ).toBe( 'https://example.test/icon.svg' );

	act( () => {
		root.unmount();
	} );
} );

it( 'shows the still copy again when the card is reused for another asset', async () => {
	const { container, root } = mount( {
		preview: 'https://example.test/one-300x300.gif',
		original: 'https://example.test/one.gif',
	} );

	await act( async () => {
		jest.advanceTimersByTime( 5000 );
	} );

	expect( srcOf( container ) ).toBe( 'https://example.test/one.gif' );

	act( () => {
		root.render(
			<Thumb
				preview="https://example.test/two-300x300.gif"
				original="https://example.test/two.gif"
			/>
		);
	} );

	expect( srcOf( container ) ).toBe( 'https://example.test/two-300x300.gif' );

	act( () => {
		root.unmount();
	} );
} );
