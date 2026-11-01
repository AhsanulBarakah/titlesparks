/**
 * Native WordPress media uploader hook.
 *
 * Wraps the core `wp.media` frame (the same modal the Media Library uses) so a
 * component can open it, let an administrator upload or choose one or more
 * images, and receive the chosen attachments. Nothing is uploaded to our own
 * endpoints: WordPress stores the file as an attachment, and we only persist a
 * reference to it, which keeps the plugin free of custom upload handling.
 *
 * `wp.media` is not loaded with the page. The uploader is a megabyte of scripts
 * and some media-library queries, and it is only needed once someone actually
 * clicks add — so the first click fetches WordPress' own markup for it and runs
 * it (`blocks/shared/mediaModal.js`), and every click after that opens the frame
 * straight away. The block editor sidebar already has `wp.media` from the
 * editor, so there this is a no-op. When the modal cannot be brought in at all,
 * `onError` is invoked instead of throwing so the caller can surface a notice.
 */

import { useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import { getMedia, loadMediaModal } from './mediaModal';

/**
 * Pick a sensible preview URL from an attachment.
 *
 * @param {Object} attachment Attachment JSON.
 * @return {string} URL to draw the attachment with.
 */
const previewUrl = ( attachment ) => {
	if (
		attachment.sizes &&
		attachment.sizes.medium &&
		attachment.sizes.medium.url
	) {
		return attachment.sizes.medium.url;
	}

	return attachment.url || '';
};

/**
 * Open the media frame once `wp.media` exists.
 *
 * @param {Object}   options
 * @param {Function} options.onSelect Receives an array of picked attachments.
 * @return {boolean} Whether the frame was opened.
 */
const openFrame = ( { onSelect } ) => {
	const media = getMedia();

	if ( ! media ) {
		return false;
	}

	const frame = media( {
		title: __( 'Add an icon or GIF', 'titlesparks' ),
		button: { text: __( 'Add to library', 'titlesparks' ) },
		library: { type: [ 'image' ] },
		multiple: true,
	} );

	frame.on( 'select', () => {
		const selection = frame.state().get( 'selection' );

		if ( ! selection ) {
			return;
		}

		const attachments = selection.toJSON().map( ( attachment ) => ( {
			id: attachment.id,
			url: attachment.url || '',
			preview: previewUrl( attachment ),
			label: attachment.title || attachment.filename || '',
			filename: attachment.filename || '',
			mime: attachment.mime || '',
			alt: attachment.alt || '',
		} ) );

		if ( attachments.length ) {
			onSelect( attachments );
		}
	} );

	frame.open();

	return true;
};

/**
 * Create a callback that opens the media modal.
 *
 * @param {Object}   options
 * @param {Function} options.onSelect Receives an array of picked attachments.
 * @param {Function} options.onError  Called when the modal is unavailable.
 * @return {Function} Open handler.
 */
export const useMediaFrame = ( { onSelect, onError } ) =>
	useCallback( () => {
		const fail = () => {
			if ( typeof onError === 'function' ) {
				onError();
			}
		};

		if ( openFrame( { onSelect } ) ) {
			return;
		}

		loadMediaModal().then( ( ready ) => {
			if ( ! ready || ! openFrame( { onSelect } ) ) {
				fail();
			}
		} );
	}, [ onSelect, onError ] );

export default useMediaFrame;
