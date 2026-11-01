<?php
/**
 * Regression tests for the settings store and the classic meta box save path.
 *
 * Covers the audit findings:
 *
 * - U3-1: a classic meta-box save must not reset the fields the form does not
 *   render (position offsets, mirror flag, the stage's own size table, per-post
 *   display).
 * - U4-1: `enabled_post_types()` must drop non-string entries, because the list
 *   reaches `register_post_meta()` on `init` where a non-string is a TypeError.
 * - U2-2: the active widget list is memoised per request and the memo is
 *   dropped by `flush_cache()`.
 *
 * Run after loading WordPress, for example:
 * php -r 'require "path/to/wp-load.php"; require "tests/php/test-settings-store.php"; titlesparks_test_settings_store();'
 *
 * Nothing is written: the merge is exercised through the private helper, and the
 * corrupted option is injected with a filter and removed again.
 *
 * @package Title_Sparks
 */

defined( 'ABSPATH' ) || exit;

use Title_Sparks\Post_Meta;
use Title_Sparks\Security;
use Title_Sparks\Settings;

/**
 * Run the settings-store tests against a bootstrapped WordPress install.
 *
 * @return void
 */
function titlesparks_test_settings_store() {
	$settings   = Settings::instance();
	$assertions = 0;
	$assert     = static function ( $condition, $message ) use ( &$assertions ) {
		++$assertions;

		if ( ! $condition ) {
			throw new RuntimeException( esc_html( $message ) );
		}
	};

	try {
		// U3-1: unrendered fields survive a classic meta-box save.
		$stored = Security::timeline(
			array(
				'enabled'          => true,
				'anchor'           => '2026-10-01 09:30:00',
				'stage_1'          => array(
					'asset_id'      => 'a',
					'position'      => 'left',
					'duration'      => 3,
					'unit'          => 'days',
					'size'          => '24px',
					'size_mode'     => 'advanced',
					'sizing_rules'  => array(
						array(
							'font' => 24,
							'icon' => 18,
						),
					),
					'flip'          => true,
				),
				'position_offsets' => array(
					'left' => array(
						'x' => -12,
						'y' => -22,
					),
				),
				'display'          => array(
					'locations' => array( 'home' => 'off' ),
				),
				// The icon's own alignment on this post, and the space beside it.
				'icon_anchor'      => 'last_line',
				'icon_spacing'     => 'flush',
			)
		);

		// Exactly the fields Meta_Box::render() posts, with the box unchecked.
		$posted = array(
			'stage_1'           => array(
				'asset_id' => 'a',
				'position' => 'left',
				'duration' => '5',
				'unit'     => 'days',
				'size'     => '24px',
			),
			'stage_2'           => array(
				'asset_id' => '',
				'position' => 'left',
				'duration' => '0',
				'unit'     => 'days',
				'size'     => '',
			),
			'stage_3'           => array(
				'asset_id' => '',
				'position' => 'left',
				'duration' => '0',
				'unit'     => 'days',
				'size'     => '',
			),
			'stage_3_behaviour' => 'keep',
		);

		$merge = new ReflectionMethod( Post_Meta::class, 'merge_classic_form' );
		$merge->setAccessible( true );

		$merged = Security::timeline( $merge->invoke( null, $stored, $posted ) );

		$assert( false === $merged['enabled'], 'An unchecked meta-box checkbox must switch the timeline off.' );
		$assert(
			array(
				'x' => -12,
				'y' => -22,
			) === $merged['position_offsets']['left'],
			'A classic save must keep the position offsets it does not render.'
		);
		$assert( true === $merged['stage_1']['flip'], 'A classic save must keep the mirror flag.' );
		$assert( 'advanced' === $merged['stage_1']['size_mode'], 'A classic save must keep the sizing mode.' );
		$assert( 18 === $merged['stage_1']['sizing_rules'][0]['icon'], 'A classic save must keep the stage\u2019s own size bands.' );
		$assert( 'off' === $merged['display']['locations']['home'], 'A classic save must keep the per-post display choice.' );
		$assert( '2026-10-01 09:30:00' === $merged['anchor'], 'A classic save must keep the timeline anchor.' );
		$assert( 'last_line' === $merged['icon_anchor'], 'A classic save must keep the icon alignment this post chose.' );
		$assert( 'flush' === $merged['icon_spacing'], 'A classic save must keep the space this post chose beside its icon.' );
		$assert( 5 === $merged['stage_1']['duration'], 'A field the form renders must take the posted value.' );

		$posted['enabled'] = '1';
		$checked           = Security::timeline( $merge->invoke( null, $stored, $posted ) );
		$assert( true === $checked['enabled'], 'A checked meta-box checkbox must switch the timeline on.' );

		// The two per-post answers are choices with a "follow the site" answer,
		// so an unrecognised value must fall back to that answer rather than to
		// the first line or the flush setting.
		$unknown = Security::timeline(
			array(
				'icon_anchor'  => 'somewhere_else',
				'icon_spacing' => 'wide',
			)
		);
		$assert( '' === $unknown['icon_anchor'], 'An unknown icon alignment must follow the site.' );
		$assert( '' === $unknown['icon_spacing'], 'An unknown icon spacing must follow the site.' );
		$assert(
			$settings->icon_anchor() === $settings->icon_anchor_for( $unknown ),
			'A post that chose no alignment must resolve to the site setting.'
		);
		$assert(
			$settings->icon_spacing() === $settings->icon_spacing_for( $unknown ),
			'A post that chose no spacing must resolve to the site setting.'
		);
		$assert(
			'block' === $settings->icon_anchor_for( Security::timeline( array( 'icon_anchor' => 'block' ) ) ),
			'A post that chose an alignment must keep it whatever the site says.'
		);
		$assert(
			'flush' === $settings->icon_spacing_for( Security::timeline( array( 'icon_spacing' => 'flush' ) ) ),
			'A post that chose no space beside its icon must keep that whatever the site says.'
		);

		$assert( 'shrink' === Security::tight_fit( 'shrink' ), 'The shrink answer must survive sanitising.' );
		$assert( 'keep' === Security::tight_fit( 'hide' ), 'A value that is not one of the two answers must fall back to keep.' );

		// U4-1: a corrupted post-type list cannot reach register_post_meta().
		$corrupt = static function () {
			return array(
				'post_types' => array( 'post', array( 'nope' ), null, 42, 'page' ),
			);
		};

		add_filter( 'pre_option_titlesparks_settings', $corrupt );
		$settings->flush_cache();
		$types = $settings->enabled_post_types();
		remove_filter( 'pre_option_titlesparks_settings', $corrupt );
		$settings->flush_cache();

		$assert(
			array( 'post', 'page' ) === $types,
			'enabled_post_types() must return only the strings it was given.'
		);

		// The bands are the one site-wide sizing answer, and they have to be drawn
		// from the same rules the browser mirrors. The stored option is replaced
		// for this read, because a site that has edited its table would otherwise
		// be answering with those rows rather than with the shipped ladder.
		$untouched = static function () {
			return array();
		};

		add_filter( 'pre_option_titlesparks_settings', $untouched );
		$settings->flush_cache();
		$assert(
			Security::default_sizing_rules() === $settings->sizing_rules(),
			'An install that never edited the bands must get the default ladder.'
		);
		remove_filter( 'pre_option_titlesparks_settings', $untouched );
		$settings->flush_cache();

		$chosen = Security::settings(
			array(
				'enabled'      => true,
				'sizing_rules' => array(
					array( 'font' => 24, 'icon' => 18 ),
					array( 'font' => 12, 'icon' => 10 ),
					array( 'font' => 12, 'icon' => 11 ),
					array( 'font' => '', 'icon' => '' ),
				),
			)
		);

		$assert(
			array(
				array( 'font' => 12, 'icon' => 11 ),
				array( 'font' => 24, 'icon' => 18 ),
			) === $chosen['sizing_rules'],
			'The bands must come back ordered by font size, one answer per size, unusable rows dropped.'
		);
		$assert(
			array() === Security::stage_sizing_rules( array() ),
			'A stage without its own bands must stay empty so it follows the site\u2019s.'
		);
		$assert(
			array( array( 'font' => 16, 'icon' => 12 ) ) === Security::stage_sizing_rules(
				array( array( 'font' => 16, 'icon' => 12 ) )
			),
			'A stage with its own bands must keep them.'
		);
		$assert(
			! array_key_exists( 'sizing_calculation', $chosen ),
			'The retired Standard/Advanced choice must not be stored any more.'
		);
		$assert(
			'fixed' === Security::size_mode( 'standard' ),
			'An unknown sizing mode must fall back to a fixed size.'
		);

		// U2-2: the active widget list is memoised and the memo is dropped.
		$memo = new ReflectionProperty( Settings::class, 'active_widgets' );
		$memo->setAccessible( true );

		$settings->flush_cache();
		$assert( null === $memo->getValue( $settings ), 'The widget memo must start empty.' );

		$first = $settings->active_widgets();
		$assert( is_array( $memo->getValue( $settings ) ), 'The widget list must be memoised on first use.' );
		$assert( $first === $settings->active_widgets(), 'The memoised list must match the first result.' );

		$settings->flush_cache();
		$assert( null === $memo->getValue( $settings ), 'flush_cache() must drop the widget memo.' );

		// Two widgets of one type share their registered name, so the list has to
		// tell them apart; a name only one widget carries stays as it is.
		$registered_widgets = isset( $GLOBALS['wp_registered_widgets'] ) ? $GLOBALS['wp_registered_widgets'] : array();
		$fake_widgets       = static function () {
			return array(
				'search-1'   => array(
					'name'      => 'Search',
					'classname' => 'widget_search',
				),
				'search-2'   => array(
					'name'      => 'Search',
					'classname' => 'widget_search',
				),
				'archives-1' => array(
					'name'      => 'Archives',
					'classname' => 'widget_archive',
				),
			);
		};
		$fake_sidebars      = static function () use ( $fake_widgets ) {
			return array(
				'sidebar-1'     => array_keys( $fake_widgets() ),
				'array_version' => 3,
			);
		};

		$GLOBALS['wp_registered_widgets'] = $fake_widgets();
		add_filter( 'pre_option_sidebars_widgets', $fake_sidebars );
		$settings->flush_cache();

		$names = array();

		foreach ( $settings->active_widgets() as $widget ) {
			$names[ $widget['id'] ] = $widget['name'];
		}

		$assert(
			'Search (search-1)' === $names['search-1'] && 'Search (search-2)' === $names['search-2'],
			'Two widgets called Search must be told apart by their instance ID.'
		);
		$assert(
			'Archives' === $names['archives-1'],
			'A widget whose name no other widget carries must keep it unchanged.'
		);

		remove_filter( 'pre_option_sidebars_widgets', $fake_sidebars );
		$GLOBALS['wp_registered_widgets'] = $registered_widgets;
		$settings->flush_cache();

		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- CLI test summary; the only placeholder is an integer counter.
		printf( "PASS: %d settings-store PHP assertions\n", $assertions );
	} finally {
		$settings->flush_cache();
	}
}
