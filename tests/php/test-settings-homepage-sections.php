<?php
/**
 * Settings tests for theme-coded homepage sections.
 *
 * Run after loading WordPress, for example:
 * php -r 'require "path/to/wp-load.php"; require "tests/php/test-settings-homepage-sections.php"; titlesparks_test_homepage_sections();'
 *
 * @package Title_Sparks
 */

defined( 'ABSPATH' ) || exit;

use Title_Sparks\Security;
use Title_Sparks\Settings;

/**
 * Run homepage-section tests against a bootstrapped WordPress install.
 *
 * The saved option is restored even if an assertion fails.
 *
 * @return void
 */
function titlesparks_test_homepage_sections() {
	$settings       = Settings::instance();
	$previous       = get_option( Settings::OPTION, false );
	$had_previous   = false !== $previous;
	$assertions     = 0;
	$assert_same    = static function ( $expected, $actual, $message ) use ( &$assertions ) {
		++$assertions;

		if ( $expected !== $actual ) {
			$detail = $message . "\nExpected: " . wp_json_encode( $expected ) . "\nActual: " . wp_json_encode( $actual );

			throw new RuntimeException( esc_html( $detail ) );
		}
	};

	try {
		$stylesheet = get_stylesheet();
		$template   = get_template();
		$sections   = $settings->homepage_sections();
		$expected   = array(
			'theme-main-featured',
			'theme-featured-grid',
			'theme-latest-post',
			'theme-other-story',
			'theme-popular-categories',
		);

		// Regression guard: the template read must hand core nothing it could take
		// for a PHP template path (handing it a WP_Block_Template once fataled
		// inside str_starts_with()). It is a read-only registry lookup, so on a
		// block theme it returns templates or an empty list, and it never throws
		// out of the settings screen. Classic sites take the other branch of this
		// file's assertions, which is why the expiry of that guard went unnoticed
		// until a block theme ran it.
		if ( function_exists( 'wp_is_block_theme' ) && wp_is_block_theme() ) {
			$templates_method = new ReflectionMethod( Settings::class, 'block_templates' );
			$templates_method->setAccessible( true );

			foreach ( array( 'wp_template', 'wp_template_part' ) as $type ) {
				$found = $templates_method->invoke( $settings, $type );

				$assert_same(
					true,
					is_array( $found ),
					'The ' . $type . ' lookup must return a list, never a template core could read as a PHP fallback path.'
				);

				$assert_same(
					true,
					array() === $found || reset( $found ) instanceof WP_Block_Template,
					'Everything the ' . $type . ' lookup returns must be a WP_Block_Template.'
				);
			}

			$assert_same(
				true,
				count( $templates_method->invoke( $settings, 'wp_template' ) ) > 0,
				'A block theme registers at least one template, so the scan must find it rather than skip the theme.'
			);
		}

		if ( array_intersect( array( 'newsonline', 'newsmash' ), array( $stylesheet, $template ) ) ) {
			$assert_same( $expected, array_column( $sections, 'id' ), 'The active news theme should expose each homepage area once and in display order.' );
			$assert_same( array( '.post-carousel-mainfeatured' ), $sections[0]['selectors'], 'Main Featured must use its rendered carousel container.' );
			$assert_same( array( '.post_columns-grid' ), $sections[1]['selectors'], 'Featured Posts must use its rendered grid container.' );
			$assert_same( array( '.dt-posts-module' ), $sections[2]['selectors'], 'Latest Post must use its rendered module container.' );
			$assert_same( array( '.post-carousel-missed' ), $sections[3]['selectors'], 'Other Story must use its rendered carousel container.' );
			$assert_same( array( '.popular-categories' ), $sections[4]['selectors'], 'Popular Categories must use its rendered category container.' );
		}

		$force_theme = static function () {
			return 'unsupported-theme';
		};
		$force_stylesheet = static function () use ( $force_theme ) {
			return $force_theme();
		};
		$force_template = static function () use ( $force_theme ) {
			return $force_theme();
		};
		$custom_sections = static function ( $items ) {
			$items[] = array(
				'id'        => 'custom-feature-area',
				'name'      => 'Custom Feature Area',
				'selectors' => array( '.custom-feature-area' ),
			);

			return $items;
		};

		add_filter( 'pre_option_stylesheet', $force_stylesheet, 9999 );
		add_filter( 'pre_option_template', $force_template, 9999 );
		$unsupported = array_column( $settings->homepage_sections(), 'id' );
		$assert_same(
			array(),
			array_values(
				array_filter(
					$unsupported,
					static function ( $id ) {
						return 0 === strpos( $id, 'theme-' );
					}
				)
			),
			'An unsupported theme should not inherit selectors for the NewsOnline/NewsMash theme.'
		);
		add_filter( 'titlesparks_homepage_sections', $custom_sections );
		$assert_same(
			true,
			in_array( 'custom-feature-area', array_column( $settings->homepage_sections(), 'id' ), true ),
			'A theme can register its own homepage sections using the extension filter.'
		);
		remove_filter( 'titlesparks_homepage_sections', $custom_sections );
		remove_filter( 'pre_option_stylesheet', $force_stylesheet, 9999 );
		remove_filter( 'pre_option_template', $force_template, 9999 );

		// The deep scan reads the front page's blocks, so a temporary static
		// front page proves that a top-level block, a nested block and a block
		// with an anchor each become their own section.
		$previous_show_on_front = get_option( 'show_on_front' );
		$previous_page_on_front = get_option( 'page_on_front' );
		$front_page_id          = wp_insert_post(
			array(
				'post_type'    => 'page',
				'post_status'  => 'publish',
				'post_title'   => 'TitleSparks scan fixture',
				'post_content' => '<!-- wp:latest-posts {"className":"ts-scan-posts"} /-->'
					. '<!-- wp:group --><!-- wp:query {"queryId":1} --><!-- /wp:query --><!-- /wp:group -->'
					. '<!-- wp:latest-posts {"anchor":"ts-scan-anchor"} /-->',
			)
		);
		update_option( 'show_on_front', 'page' );
		update_option( 'page_on_front', $front_page_id );
		$settings->flush_cache();

		// The scan is cached until a save marks it stale, so the fixture is
		// only read after a rebuild has replaced the cache from earlier in
		// this run.
		$settings->rebuild_scan();
		$scanned       = $settings->homepage_sections();
		$scanned_by_id = array_column( $scanned, null, 'id' );

		try {
			$assert_same( true, isset( $scanned_by_id['page-class-ts-scan-posts'] ), 'An author class on a front-page block should become its own section.' );
			$assert_same(
				array( '.ts-scan-posts' ),
				isset( $scanned_by_id['page-class-ts-scan-posts'] ) ? $scanned_by_id['page-class-ts-scan-posts']['selectors'] : array(),
				'A scanned block should gate on its author-written class.'
			);
			$latest_posts_type  = WP_Block_Type_Registry::get_instance()->get_registered( 'core/latest-posts' );
			$latest_posts_title = $latest_posts_type && isset( $latest_posts_type->title ) && is_string( $latest_posts_type->title )
				? trim( $latest_posts_type->title )
				: '';

			if ( '' === $latest_posts_title ) {
				$latest_posts_title = 'Latest Posts';
			}

			$assert_same(
				$latest_posts_title,
				isset( $scanned_by_id['page-class-ts-scan-posts'] ) ? $scanned_by_id['page-class-ts-scan-posts']['name'] : '',
				'A scanned block should be named after its registered block type.'
			);
			$assert_same( true, isset( $scanned_by_id['page-class-wp-block-query'] ), 'A block nested in a container should still be scanned.' );
			$assert_same(
				array( '.wp-block-query' ),
				isset( $scanned_by_id['page-class-wp-block-query'] ) ? $scanned_by_id['page-class-wp-block-query']['selectors'] : array(),
				'A block without a class should fall back to the class WordPress renders for it.'
			);
			$assert_same( true, isset( $scanned_by_id['page-anchor-ts-scan-anchor'] ), 'A block anchor should produce a stable section id.' );
			$assert_same(
				array( '#ts-scan-anchor' ),
				isset( $scanned_by_id['page-anchor-ts-scan-anchor'] ) ? $scanned_by_id['page-anchor-ts-scan-anchor']['selectors'] : array(),
				'A scanned block should prefer its anchor over a generated class.'
			);
		} finally {
			wp_delete_post( $front_page_id, true );

			if ( false === $previous_show_on_front ) {
				delete_option( 'show_on_front' );
			} else {
				update_option( 'show_on_front', $previous_show_on_front );
			}

			if ( false === $previous_page_on_front ) {
				delete_option( 'page_on_front' );
			} else {
				update_option( 'page_on_front', $previous_page_on_front );
			}

			$settings->flush_cache();
		}

		$raw_choices = array(
			'custom-feature-area' => 'no',
			'Custom Section!'     => 'yes',
			''                    => true,
		);
		$stored = $settings->update(
			array_merge(
				$settings->all(),
				array( 'section_display' => $raw_choices )
			)
		);
		$assert_same(
			array(
				'custom-feature-area' => false,
				'customsection'       => true,
			),
			$stored['section_display'],
			'Section choice keys and booleans should be sanitized before persistence.'
		);
		$assert_same( $stored['section_display'], get_option( Settings::OPTION )['section_display'], 'Sanitized section choices should persist in the settings option.' );
		$assert_same( $stored['section_display'], $settings->section_display(), 'The settings accessor should return the persisted choices.' );

		add_filter( 'pre_option_stylesheet', $force_stylesheet, 9999 );
		add_filter( 'pre_option_template', $force_template, 9999 );
		add_filter( 'titlesparks_homepage_sections', $custom_sections );
		$choices = array_column( $settings->homepage_section_choices(), null, 'id' );
		$assert_same( false, isset( $choices['custom-feature-area'] ) ? $choices['custom-feature-area']['enabled'] : true, 'The saved off choice should disable only its matching theme section.' );
		remove_filter( 'titlesparks_homepage_sections', $custom_sections );
		remove_filter( 'pre_option_stylesheet', $force_stylesheet, 9999 );
		remove_filter( 'pre_option_template', $force_template, 9999 );

		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- CLI test summary; the only placeholder is an integer counter.
		printf( "PASS: %d homepage-section PHP assertions\n", $assertions );
	} finally {
		if ( $had_previous ) {
			update_option( Settings::OPTION, $previous );
		} else {
			delete_option( Settings::OPTION );
		}

		$settings->flush_cache();
	}
}
