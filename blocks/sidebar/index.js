/**
 * Block editor sidebar entry point.
 *
 * Registers a `PluginSidebar` through `registerPlugin`, which is the supported
 * way to add UI to the post editor. `PluginSidebar` is imported from
 * `@wordpress/editor` rather than `@wordpress/edit-post`, because the editor
 * package's copy works in both the post and site editors while the edit-post
 * copy has been deprecated since WordPress 6.6.
 *
 * The bundle is only enqueued by `Title_Sparks\Admin\Block_Assets` on post types
 * where the feature is enabled, so the sidebar appears exactly where the
 * settings say it should.
 */

import { registerPlugin } from '@wordpress/plugins';
import { PluginSidebar } from '@wordpress/editor';
import { __ } from '@wordpress/i18n';

// Scoped Tailwind (utilities written `titlesparks:…`, no preflight). See
// blocks/shared/tailwind.css.
import '@titlesparks/shared/tailwind.css';

import EditorTitleIcon from '@titlesparks/shared/EditorTitleIcon';
import NewsTitleSidebar from './sidebar';
import { IconTitlesparks } from '@titlesparks/shared/icons';

const SIDEBAR_NAME = 'titlesparks';

const SIDEBAR_ICON = (
	<IconTitlesparks className="titlesparks:h-5 titlesparks:w-5" />
);

registerPlugin( SIDEBAR_NAME, {
	icon: SIDEBAR_ICON,
	render: () => (
		<>
			{ /* No slot renders into the post title, so this draws the live
			     icon beside the real title in the canvas instead. */ }
			<EditorTitleIcon />
			<PluginSidebar
				name={ SIDEBAR_NAME }
				title={ __( 'TitleSparks', 'titlesparks' ) }
				icon={ SIDEBAR_ICON }
			>
				{ /* The root the plugin's utilities are scoped to; see
				     tailwind.config.js. Without it the panel's classes would lose to
				     wp-admin's own element rules. */ }
				<div className="titlesparks-app">
					<NewsTitleSidebar />
				</div>
			</PluginSidebar>
		</>
	),
} );
