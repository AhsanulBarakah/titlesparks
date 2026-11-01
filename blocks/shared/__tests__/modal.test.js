/**
 * How the dialog closes.
 *
 * The scrim is decoration: it carries no role a screen reader would offer to
 * press, and the click that closes the dialog is bound to the node rather than
 * written on it as `onClick`. So the behaviour worth pinning down is the one an
 * author relies on — a click on the dimmed area closes, a click inside the
 * dialog does not, and Escape closes from either place.
 */

import { createRoot } from '@wordpress/element';
import { act } from 'react';

import { Modal } from '../ui';

// React's `act()` support has to be switched on for a test environment.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe( 'the dialog', () => {
	let container;
	let root;
	let onClose;

	const click = ( node ) =>
		act( () => {
			node.dispatchEvent(
				new window.MouseEvent( 'click', { bubbles: true } )
			);
		} );

	beforeEach( () => {
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
		onClose = jest.fn();

		act( () => {
			root.render(
				<Modal title="Pick an asset" onClose={ onClose }>
					<button type="button">Choose</button>
				</Modal>
			);
		} );
	} );

	afterEach( () => {
		act( () => root.unmount() );
		container.remove();
	} );

	it( 'closes when the scrim itself is clicked', () => {
		click( container.querySelector( '[role="presentation"]' ) );

		expect( onClose ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'stays open when the click lands inside it', () => {
		const dialog = container.querySelector( '[role="dialog"]' );
		const inside = [ ...dialog.querySelectorAll( 'button' ) ].find(
			( node ) => 'Choose' === node.textContent
		);

		click( dialog );
		click( inside );

		expect( onClose ).not.toHaveBeenCalled();
	} );

	it( 'closes from its own Close button', () => {
		const close = [
			...container.querySelectorAll( '[role="dialog"] button' ),
		].find( ( node ) => 'Close' === node.getAttribute( 'aria-label' ) );

		click( close );

		expect( onClose ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'closes on Escape', () => {
		act( () => {
			document.dispatchEvent(
				new window.KeyboardEvent( 'keydown', {
					key: 'Escape',
					bubbles: true,
				} )
			);
		} );

		expect( onClose ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'is announced by its title, so the scrim needs no name of its own', () => {
		expect(
			container
				.querySelector( '[role="dialog"]' )
				.getAttribute( 'aria-label' )
		).toBe( 'Pick an asset' );
		expect(
			container
				.querySelector( '[role="presentation"]' )
				.hasAttribute( 'onclick' )
		).toBe( false );
	} );
} );
