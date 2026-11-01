<?php
/**
 * Global settings storage.
 *
 * Everything the plugin persists site-wide lives in one option row
 * (`titlesparks_settings`) behind this class, so defaults, validation and cache
 * invalidation cannot drift apart between call sites. The per-post timelines
 * live in post meta (`Title_Sparks\Post_Meta`); this class only owns the global
 * switches and the asset library.
 *
 * @package Title_Sparks
 */

namespace Title_Sparks;

defined( 'ABSPATH' ) || exit;

/**
 * Class Settings
 */
final class Settings {

	/**
	 * Option name.
	 */
	const OPTION = TITLE_SPARKS_OPTION_NAME;

	/**
	 * Transient that holds the last deep scan.
	 *
	 * The scan reads templates and content, which is too much to repeat on
	 * every front-end request; the renderer needs its selectors on each page.
	 */
	const SCAN_TRANSIENT = 'titlesparks_scanned_sections';

	/**
	 * Transient that holds the sidebar-to-pages map read from the theme.
	 */
	const SIDEBAR_CONTEXTS_TRANSIENT = 'titlesparks_sidebar_contexts';

	/**
	 * Option that marks the cached scan as out of date.
	 *
	 * A save marks the cache stale instead of deleting it, so a visitor's
	 * request never has to rebuild it: the last scan keeps being served until
	 * cron, the admin or a REST request rebuilds it.
	 */
	const SCAN_STALE_OPTION = 'titlesparks_scan_stale';

	/**
	 * Transient that stops two requests rebuilding the scan at once.
	 */
	const SCAN_LOCK_TRANSIENT = 'titlesparks_scan_lock';

	/**
	 * Seconds the rebuild lock is held before it expires on its own.
	 */
	const SCAN_LOCK_SECONDS = 300;

	/**
	 * Cron hook that rebuilds the cached scan.
	 */
	const SCAN_CRON_HOOK = 'titlesparks_rebuild_scan';

	/**
	 * How many theme PHP files the sidebar map reads.
	 */
	const THEME_FILE_LIMIT = 200;

	/**
	 * The largest theme PHP file the sidebar map reads, in bytes.
	 */
	const THEME_FILE_MAX_BYTES = 262144;

	/**
	 * The most the sidebar map reads in total, in bytes.
	 *
	 * A theme can ship a lot of PHP; the point is to find `dynamic_sidebar()`
	 * calls, and a few megabytes of templates is more than enough for that. The
	 * budget counts only files that are actually read, so a theme that is mostly
	 * JavaScript is not penalised for it.
	 */
	const THEME_TOTAL_MAX_BYTES = 4194304;

	/**
	 * Singleton instance.
	 *
	 * @var Settings|null
	 */
	private static $instance = null;

	/**
	 * In-request cache of the merged settings.
	 *
	 * @var array|null
	 */
	private $cache = null;

	/**
	 * In-request memo of the homepage sections the deep scan found.
	 *
	 * Parsing the front page costs more than reading the option, and the
	 * renderer asks for the sections once per post on a homepage, so the scan
	 * runs once per request.
	 *
	 * @var array|null
	 */
	private $scanned_sections = null;

	/**
	 * In-request memo of the sidebar-to-pages map.
	 *
	 * @var array<string, string[]>|null
	 */
	private $sidebar_contexts = null;

	/**
	 * How many nested rebuilds hold the scan lock in this request.
	 *
	 * A rebuild reads both the section list and the sidebar map, and each of
	 * those takes the lock itself. Counting the nesting keeps the transient
	 * held until the outermost rebuild is finished.
	 *
	 * @var int
	 */
	private $scan_lock_depth = 0;

	/**
	 * In-request memo of the active widget list.
	 *
	 * Building it walks every sidebar and asks each widget object for its
	 * settings, which is real work: the renderer asks once per rendered widget
	 * and once per eligible post on a page, so without this the same list is
	 * rebuilt a dozen times per homepage request.
	 *
	 * @var array|null
	 */
	private $active_widgets = null;

	/**
	 * Get the shared instance.
	 *
	 * @return Settings
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Default settings, also used to migrate partially saved rows.
	 *
	 * The stage defaults are only a starting point for new posts; an author can
	 * override every value per post.
	 *
	 * @return array
	 */
	public function defaults() {
		return array(
			'enabled'           => false,
			'post_types'        => array( 'post' ),
			// Location controls default on to preserve the existing intended
			// behaviour for singular pages and post listings.
			'display_locations' => array(
				'singular' => true,
				'home'     => true,
				'archive'  => true,
				// Search results keep their own switch; an untouched site shows
				// icons there like the listing it is.
				'search'   => true,
			),
			'widget_display'    => array(),
			'section_display'   => array(),
			'assets'            => array(),
			// Folders are a view over asset tags, so they live beside the library
			// they describe rather than in an option of their own.
			'folders'           => array(),
			'default_stage_1'   => array(
				'asset_id' => '',
				'position' => 'left',
				'duration' => 1,
				'unit'     => 'days',
			),
			'default_stage_2'   => array(
				'asset_id' => '',
				'position' => 'left',
				'duration' => 2,
				'unit'     => 'days',
			),
			'default_stage_3'   => array(
				'asset_id' => '',
				'position' => 'left',
				'duration' => 7,
				'unit'     => 'days',
			),
			'default_behaviour' => 'keep',
			// An icon inside a narrow card is drawn exactly as the author placed
			// it until an administrator asks for it to be fitted.
			'tight_fit'         => 'keep',
			// An animated GIF cannot be paused by CSS. On by default, so a reader
			// whose system asks for less motion is drawn a still frame; it only
			// changes the page for readers who asked, and a movement they cannot
			// stop is the worse default.
			'reduced_motion'    => true,
			// The icon is measured from the title's first line, so the offset the
			// author set keeps it on that line when the title wraps.
			'icon_anchor'       => 'first_line',
			// The usual space beside the icon. A post may ask for none, or for
			// this answer, which is what an untouched post stores.
			'icon_spacing'      => 'gap',
			// The page's own stacking order. The icon is positioned already, so
			// this only matters where a theme stacks something over the title;
			// 0 leaves that decision exactly as it was.
			'icon_z_index'      => 0,
			// Title-size bands for a title-following icon, as `{ font, icon }`
			// pixel pairs. Empty here and normalised on read, so the default
			// ladder ships without being written into every install.
			'sizing_rules'      => array(),
			'anchor_source'     => 'post',
			'anchor_datetime'   => '',
		);
	}

	/**
	 * Read the merged settings.
	 *
	 * Merging on read means a new setting shipped in an update starts working
	 * immediately, without a migration routine.
	 *
	 * @return array
	 */
	public function all() {
		if ( null !== $this->cache ) {
			return $this->cache;
		}

		$stored = get_option( self::OPTION, array() );

		if ( ! is_array( $stored ) ) {
			$stored = array();
		}

		$this->cache = array_merge( $this->defaults(), $stored );

		return $this->cache;
	}

	/**
	 * Read a single setting.
	 *
	 * @param string $key     Setting key.
	 * @param mixed  $default Fallback when the key is absent.
	 * @return mixed
	 */
	public function get( $key, $default = null ) {
		$all = $this->all();

		return array_key_exists( $key, $all ) ? $all[ $key ] : $default;
	}

	/**
	 * Whether the feature is switched on site-wide.
	 *
	 * @return bool
	 */
	public function is_enabled() {
		return (bool) $this->get( 'enabled', false );
	}

	/**
	 * What to do when an icon has no room inside its card.
	 *
	 * @return string One of `Security::allowed_tight_fits()`.
	 */
	public function tight_fit() {
		// One switch in Settings: on is `shrink`, off is `keep`. The value is
		// sanitized on read, so a row that is not one of the two answers cannot
		// make an icon shrink or disappear.
		return Security::tight_fit( $this->get( 'tight_fit', 'keep' ) );
	}

	/**
	 * Whether a reader who asks for less motion is shown a still icon.
	 *
	 * On by default, because it only changes the page for a reader who asked
	 * their system for less motion. Read through `Security` nowhere: it is a
	 * plain boolean, so a stored row that is not one still resolves to a
	 * boolean.
	 *
	 * @return bool
	 */
	public function reduced_motion() {
		return (bool) $this->get( 'reduced_motion', true );
	}

	/**
	 * What the icon's vertical position is measured against.
	 *
	 * @return string One of `Security::allowed_icon_anchors()`.
	 */
	public function icon_anchor() {
		return Security::icon_anchor( $this->get( 'icon_anchor', 'first_line' ) );
	}

	/**
	 * What one post's icon is measured from.
	 *
	 * The post's own answer wins when its author gave one; otherwise the site
	 * setting applies, so a post that never touched the field follows the site
	 * as it changes.
	 *
	 * @param array $timeline Sanitized post timeline.
	 * @return string One of `Security::allowed_icon_anchors()`.
	 */
	public function icon_anchor_for( array $timeline ) {
		$own = Security::icon_anchor_override(
			isset( $timeline['icon_anchor'] ) ? $timeline['icon_anchor'] : ''
		);

		return '' !== $own ? $own : $this->icon_anchor();
	}

	/**
	 * The space this site leaves beside an icon.
	 *
	 * @return string `gap` or `flush`.
	 */
	public function icon_spacing() {
		return Security::icon_spacing( $this->get( 'icon_spacing', 'gap' ) );
	}

	/**
	 * The space beside one post's icon.
	 *
	 * The post's own answer wins when its author gave one; otherwise the site
	 * setting applies, so a post that never chose keeps up with the site.
	 *
	 * @param array $timeline Sanitized post timeline.
	 * @return string `gap` or `flush`.
	 */
	public function icon_spacing_for( array $timeline ) {
		$own = Security::icon_spacing_override(
			isset( $timeline['icon_spacing'] ) ? $timeline['icon_spacing'] : ''
		);

		return '' !== $own ? $own : $this->icon_spacing();
	}

	/**
	 * The icon's stacking order on the page.
	 *
	 * @return int `0` for the page's normal order, or a signed `z-index`.
	 */
	public function icon_z_index() {
		return Security::icon_z_index( $this->get( 'icon_z_index', 0 ) );
	}

	/**
	 * The title-size bands a title-following icon is sized from.
	 *
	 * These are the site's defaults; a stage can carry its own table in the
	 * post editor. Normalised on read, so an install that has never edited them
	 * still gets the default ladder rather than an empty table.
	 *
	 * @return array<int,array{font:int,icon:int}>
	 */
	public function sizing_rules() {
		return Security::sizing_rules( $this->get( 'sizing_rules', array() ) );
	}

	/**
	 * Post types the feature is allowed on.
	 *
	 * @return string[]
	 */
	public function enabled_post_types() {
		$post_types = $this->get( 'post_types', array() );

		if ( ! is_array( $post_types ) ) {
			return array();
		}

		// Every write path stores only real, public post type names, but this
		// value also reaches `register_post_meta()` on `init`. A non-string
		// element there (a hand-edited row, an import, another plugin writing
		// the option) is a TypeError that would take the whole site down, so
		// the list is filtered rather than trusted.
		return array_values( array_filter( $post_types, 'is_string' ) );
	}

	/**
	 * Display locations enabled for the front end.
	 *
	 * @return array{singular: bool, home: bool, archive: bool, search: bool}
	 */
	public function display_locations() {
		return Security::display_locations( $this->get( 'display_locations', array() ) );
	}

	/**
	 * Per-widget display choices keyed by the registered widget instance ID.
	 *
	 * @return array<string, bool>
	 */
	public function widget_display() {
		return Security::widget_display( $this->get( 'widget_display', array() ) );
	}

	/**
	 * Per-theme-section display choices keyed by section ID.
	 *
	 * @return array<string, bool>
	 */
	public function section_display() {
		return Security::section_display( $this->get( 'section_display', array() ) );
	}

	/**
	 * Theme sections that can show icons, with their display selectors.
	 *
	 * The list has three sources, in this order:
	 *
	 * 1. Known components of the bundled news themes, matched by name.
	 * 2. The deep scan: every template the site renders pages from — the front
	 *    page, the single-post and page templates, archives and search results,
	 *    the template parts — and the recent stored content of every public
	 *    post type, one section per block that can hold post titles. Each
	 *    section records the page contexts its source renders in, so its switch
	 *    only gates the pages it actually appears on.
	 * 3. The `titlesparks_homepage_sections` filter, for a theme that wants to
	 *    register areas of its own. The hook keeps its original name, and now
	 *    covers every template rather than the homepage alone.
	 *
	 * Titles remain matched by post permalink in the browser; a section only
	 * decides which matches its selector may decorate.
	 *
	 * @return array<int, array{id: string, name: string, selectors: string[], contexts?: string[], sources?: string[]}>
	 */
	public function homepage_sections() {
		$sections = array();
		$themes   = array( get_stylesheet(), get_template() );

		if ( array_intersect( array( 'newsonline', 'newsmash' ), $themes ) ) {
			// The bundled news themes print these areas on the homepage, so
			// their switches keep to the homepage and leave the copies a single
			// post prints elsewhere alone.
			$sections = array(
				array(
					'id'        => 'theme-main-featured',
					'name'      => __( 'Main Featured', 'titlesparks' ),
					'selectors' => array( '.post-carousel-mainfeatured' ),
					'contexts'  => array( 'home' ),
				),
				array(
					'id'        => 'theme-featured-grid',
					'name'      => __( 'Featured Posts', 'titlesparks' ),
					'selectors' => array( '.post_columns-grid' ),
					'contexts'  => array( 'home' ),
				),
				array(
					'id'        => 'theme-latest-post',
					'name'      => __( 'Latest Post', 'titlesparks' ),
					'selectors' => array( '.dt-posts-module' ),
					'contexts'  => array( 'home' ),
				),
				array(
					'id'        => 'theme-other-story',
					'name'      => __( 'Other Story', 'titlesparks' ),
					'selectors' => array( '.post-carousel-missed' ),
					'contexts'  => array( 'home' ),
				),
				array(
					'id'        => 'theme-popular-categories',
					'name'      => __( 'Popular Categories', 'titlesparks' ),
					'selectors' => array( '.popular-categories' ),
					'contexts'  => array( 'home' ),
				),
			);
		}

		$sections = array_merge( $sections, $this->scanned_sections() );

		/**
		 * Filter the theme sections with independent icon controls.
		 *
		 * The name is kept for compatibility; the sections it receives come from
		 * every template, not only the homepage.
		 *
		 * @param array  $sections Current theme sections.
		 * @param string $stylesheet Active stylesheet slug.
		 * @param string $template Active template slug.
		 */
		$sections = apply_filters( 'titlesparks_homepage_sections', $sections, get_stylesheet(), get_template() );

		return is_array( $sections ) ? $sections : array();
	}

	/**
	 * Sections found by scanning every template the site renders pages from.
	 *
	 * Block templates and a static front page render the same predictable
	 * `wp-block-*` classes, so a block's own class is a selector that works on
	 * the front end without the plugin writing anything into the page. Scanning
	 * only the homepage missed the most common case: a single post template
	 * prints its own related-posts rail, its own post-list blocks and its own
	 * template parts, and none of them had a switch to turn.
	 *
	 * Each section records the page contexts its source renders in, because the
	 * same selector on a single-post template belongs to a different page than
	 * one on the front page. A selector found in more than one template is one
	 * section with every context and source listed, so the reader still sees
	 * one switch per block class.
	 *
	 * @return array<int, array{id: string, name: string, selectors: string[], contexts: string[], sources: string[]}>
	 */
	private function scanned_sections() {
		if ( null !== $this->scanned_sections ) {
			return $this->scanned_sections;
		}

		$this->scanned_sections = array();

		/*
		 * The renderer asks for these on every front-end request now, because a
		 * section found on a single-post or archive template gates that page too.
		 * Parsing forty items per page view would be work nobody asked for, so
		 * the result is cached until something it was read from changes: saving
		 * or deleting a post, or switching the theme, forgets it (see
		 * `register()`), and the next request scans once and caches again.
		 */
		$cached = get_transient( self::SCAN_TRANSIENT );

		if ( is_array( $cached ) && ! $this->scan_is_stale() ) {
			$this->scanned_sections = $cached;

			return $this->scanned_sections;
		}

		if ( ! $this->may_scan() || ! $this->acquire_scan_lock() ) {
			// A visitor, or a request that arrived while another was rebuilding,
			// is served the last scan there is and the rebuild is queued. Theme
			// files and templates are never read here.
			$this->schedule_scan_rebuild();

			$this->scanned_sections = is_array( $cached ) ? $cached : array();

			return $this->scanned_sections;
		}

		$sections = array();
		$known    = array();

		foreach ( $this->block_template_sources() as $source ) {
			// One section per selector inside a template; a second template
			// holding the same block adds its own context to that section.
			$seen = array();

			foreach ( $this->sections_from_blocks( parse_blocks( $source['content'] ), $seen ) as $section ) {
				$id = $section['id'];

				if ( isset( $known[ $id ] ) ) {
					$index = $known[ $id ];

					$sections[ $index ]['contexts'] = array_values(
						array_unique( array_merge( $sections[ $index ]['contexts'], $source['contexts'] ) )
					);
					$sections[ $index ]['sources'] = array_values(
						array_unique( array_merge( $sections[ $index ]['sources'], array( $source['label'] ) ) )
					);

					continue;
				}

				$known[ $id ] = count( $sections );
				$sections[]   = array(
					'id'        => $id,
					'name'      => $section['name'],
					'selectors' => $section['selectors'],
					'contexts'  => array_values( array_unique( $source['contexts'] ) ),
					'sources'   => array( $source['label'] ),
				);
			}
		}

		$this->scanned_sections = $sections;

		set_transient( self::SCAN_TRANSIENT, $sections, WEEK_IN_SECONDS );

		// Both maps come from the same save, so the rebuild that refreshes one
		// refreshes the other before it clears the stale mark.
		$this->sidebar_contexts();

		delete_option( self::SCAN_STALE_OPTION );

		$this->release_scan_lock();

		return $this->scanned_sections;
	}

	/**
	 * Whether the cached scan has been marked out of date by a save.
	 *
	 * @return bool
	 */
	private function scan_is_stale() {
		return (bool) get_option( self::SCAN_STALE_OPTION, false );
	}

	/**
	 * Whether this request may rebuild the scan.
	 *
	 * Reading the theme's templates and the site's content is real work, so it
	 * belongs to requests a visitor is not waiting on: the admin, the REST API,
	 * cron, WP-CLI, and a command-line script that loads WordPress.
	 *
	 * @return bool
	 */
	private function may_scan() {
		if ( is_admin() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
			return true;
		}

		if ( function_exists( 'wp_doing_cron' ) && wp_doing_cron() ) {
			return true;
		}

		if ( defined( 'WP_CLI' ) && WP_CLI ) {
			return true;
		}

		return 'cli' === PHP_SAPI;
	}

	/**
	 * Take the rebuild lock, so concurrent requests cannot rebuild together.
	 *
	 * @return bool Whether this request holds the lock.
	 */
	private function acquire_scan_lock() {
		if ( $this->scan_lock_depth > 0 ) {
			++$this->scan_lock_depth;

			return true;
		}

		if ( false !== get_transient( self::SCAN_LOCK_TRANSIENT ) ) {
			return false;
		}

		set_transient( self::SCAN_LOCK_TRANSIENT, 1, self::SCAN_LOCK_SECONDS );

		$this->scan_lock_depth = 1;

		return true;
	}

	/**
	 * Release the lock once the outermost rebuild in this request is done.
	 *
	 * @return void
	 */
	private function release_scan_lock() {
		if ( $this->scan_lock_depth > 1 ) {
			--$this->scan_lock_depth;

			return;
		}

		if ( 1 === $this->scan_lock_depth ) {
			$this->scan_lock_depth = 0;

			delete_transient( self::SCAN_LOCK_TRANSIENT );
		}
	}

	/**
	 * Queue one rebuild of the cached scan.
	 *
	 * `wp_next_scheduled()` is what keeps a burst of saves from queueing a dozen
	 * identical rebuilds.
	 *
	 * @return void
	 */
	private function schedule_scan_rebuild() {
		if ( wp_next_scheduled( self::SCAN_CRON_HOOK ) ) {
			return;
		}

		wp_schedule_single_event( time() + MINUTE_IN_SECONDS, self::SCAN_CRON_HOOK );
	}

	/**
	 * Rebuild the cached scan and the sidebar map now.
	 *
	 * Runs on cron after a save marked the cache stale, and from the manual
	 * rescan route. A request that cannot take the lock leaves the work to the
	 * one that holds it.
	 *
	 * @return void
	 */
	public function rebuild_scan() {
		if ( ! $this->may_scan() ) {
			$this->schedule_scan_rebuild();

			return;
		}

		if ( ! $this->acquire_scan_lock() ) {
			return;
		}

		try {
			delete_transient( self::SCAN_TRANSIENT );
			delete_transient( self::SIDEBAR_CONTEXTS_TRANSIENT );
			delete_option( self::SCAN_STALE_OPTION );

			$this->scanned_sections = null;
			$this->sidebar_contexts = null;
			$this->active_widgets   = null;

			$this->scanned_sections();
		} finally {
			$this->release_scan_lock();
		}
	}

	/**
	 * Register the hooks that keep the cached scan honest.
	 *
	 * The scan is read from the database and cached, because the renderer needs
	 * its selectors on every page. Any save can change what a template, a post
	 * or a page holds, so the cache is forgotten on the next save rather than
	 * aged out; a theme switch changes every selector at once.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'save_post', array( $this, 'forget_scan_on_save' ) );
		add_action( 'deleted_post', array( $this, 'forget_scan' ) );
		add_action( 'switch_theme', array( $this, 'forget_scan' ) );
		add_action( self::SCAN_CRON_HOOK, array( $this, 'rebuild_scan' ) );
	}

	/**
	 * Forget the cached scan after a save that could change it.
	 *
	 * `save_post` fires for more than an author pressing save. An autosave is
	 * stored as a revision, a revision is a copy of content rather than content,
	 * and a menu item or a post type that is not public never appears in the
	 * scan at all: none of them can change what the scan read, so forgetting the
	 * cache for them only makes the next page view rescan every template for
	 * nothing.
	 *
	 * Templates are the exception the public check would otherwise swallow.
	 * `wp_template` and `wp_template_part` are not public — the Site Editor
	 * keeps them out of the front end — yet they are exactly what
	 * `block_template_sources()` parses. A template edited in the Site Editor
	 * can add, remove or move a block, so its sections have to appear (or go) on
	 * the next request rather than up to a week later. Nothing else the scan
	 * reads is a non-public post type: `wp_global_styles` and `wp_navigation`
	 * are never parsed for sections, so saving one changes no selector.
	 *
	 * @param int $post_id Post ID being saved.
	 * @return void
	 */
	public function forget_scan_on_save( $post_id ) {
		if ( wp_is_post_autosave( $post_id ) || wp_is_post_revision( $post_id ) ) {
			return;
		}

		$post_type = get_post_type( $post_id );

		if ( 'nav_menu_item' === $post_type ) {
			return;
		}

		// A template edit changes the very content the scan reads, so it drops
		// the cache even though the post type is not public.
		if ( 'wp_template' === $post_type || 'wp_template_part' === $post_type ) {
			$this->forget_scan();

			return;
		}

		$object = get_post_type_object( $post_type );

		if ( ! $object || empty( $object->public ) ) {
			return;
		}

		$this->forget_scan();
	}

	/**
	 * Mark the cached scan stale and queue a rebuild.
	 *
	 * The cache is kept rather than deleted: deleting it is what made the next
	 * visitor's request read every template and theme file again. A stale cache
	 * still answers the front end, and cron or the next admin request rebuilds
	 * it.
	 *
	 * @return void
	 */
	public function forget_scan() {
		update_option( self::SCAN_STALE_OPTION, 1, false );

		$this->schedule_scan_rebuild();

		$this->scanned_sections = null;
		$this->sidebar_contexts = null;
		$this->active_widgets   = null;
	}

	/**
	 * The stored block content this site renders pages from.
	 *
	 * Four sources, in the order a reader meets them: a static front page's own
	 * content, every block template the theme (or a plugin) ships, the template
	 * parts those templates are built from, and the site's own page and post
	 * content. The last source matters most: a classic theme keeps its
	 * single-post and single-page layout in its PHP template, which cannot be
	 * read, but whatever the author put in the post or page itself — a related
	 * posts block, a query loop, a "more stories" list — renders there, and
	 * different posts and pages hold different blocks. One sample per type
	 * found only the first layout; every sampled item is read instead.
	 *
	 * Reading the active theme's templates is a plain registry lookup, so an
	 * inactive theme's templates are not offered and no file is executed.
	 *
	 * @return array<int, array{label: string, contexts: string[], content: string}>
	 */
	private function block_template_sources() {
		$sources       = array();
		$front_page_id = (int) get_option( 'page_on_front' );

		if ( $front_page_id > 0 ) {
			$content = get_post_field( 'post_content', $front_page_id, 'raw' );

			if ( is_string( $content ) && '' !== trim( $content ) ) {
				$sources[] = array(
					'label'    => __( 'Front page', 'titlesparks' ),
					'contexts' => array( 'home' ),
					'content'  => $content,
				);
			}
		}

		foreach ( $this->block_templates( 'wp_template' ) as $template ) {
			$content = isset( $template->content ) ? (string) $template->content : '';

			if ( '' === trim( $content ) ) {
				continue;
			}

			$slug = isset( $template->slug ) ? (string) $template->slug : '';

			$sources[] = array(
				'label'    => $this->template_label( $slug ),
				'contexts' => $this->template_contexts( $slug ),
				'content'  => $content,
			);
		}

		foreach ( $this->block_templates( 'wp_template_part' ) as $part ) {
			$content = isset( $part->content ) ? (string) $part->content : '';

			if ( '' === trim( $content ) ) {
				continue;
			}

			$slug = isset( $part->slug ) ? (string) $part->slug : '';

			$sources[] = array(
				/* translators: %s: template part slug, for example "sidebar". */
				'label'    => sprintf( __( 'Template part: %s', 'titlesparks' ), $this->template_label( $slug ) ),
				// A part is rendered by whichever template includes it, so its
				// sections can appear on any page.
				'contexts' => array( 'all' ),
				'content'  => $content,
			);
		}

		return array_merge( $sources, $this->content_sources() );
	}

	/**
	 * The registered block templates (or parts) of the active theme.
	 *
	 * `get_block_templates()` is a read-only registry lookup and returns an
	 * empty list for a classic theme, so a site that has no block templates
	 * scans exactly as it did before.
	 *
	 * @param string $type `wp_template` or `wp_template_part`.
	 * @return array<int, \WP_Block_Template>
	 */
	private function block_templates( $type ) {
		if ( ! function_exists( 'get_block_templates' ) ) {
			return array();
		}

		try {
			$templates = get_block_templates( array(), $type );
		} catch ( \Throwable $e ) {
			// A read-only template lookup must never break the admin screen.
			return array();
		}

		return is_array( $templates ) ? $templates : array();
	}

	/**
	 * The page contexts a template renders in.
	 *
	 * The four display locations are used, so a section's switch can be gated by
	 * the page it is drawn on. `all` is a template part, which any page may
	 * include.
	 *
	 * @param string $slug Template slug, for example `single-news`.
	 * @return string[] `home`, `singular`, `archive`, `search` or `all`.
	 */
	private function template_contexts( $slug ) {
		$slug = strtolower( (string) $slug );

		$exact = array(
			'front-page' => array( 'home' ),
			'home'       => array( 'home' ),
			'index'      => array( 'home', 'singular', 'archive', 'search' ),
			'single'     => array( 'singular' ),
			'singular'   => array( 'singular' ),
			'page'       => array( 'singular' ),
			'archive'    => array( 'archive' ),
			'category'   => array( 'archive' ),
			'tag'        => array( 'archive' ),
			'author'     => array( 'archive' ),
			'date'       => array( 'archive' ),
			'taxonomy'   => array( 'archive' ),
			'search'     => array( 'search' ),
			// A 404 resolves as a listing on the front end, so its own
			// template follows the archive switch.
			'404'        => array( 'archive' ),
		);

		if ( isset( $exact[ $slug ] ) ) {
			return $exact[ $slug ];
		}

		// A post-type template is named after the slug it serves:
		// `single-news`, `singular-post`, `archive-news`, `search-books`.
		foreach ( array( 'single-' => 'singular', 'singular-' => 'singular', 'page-' => 'singular', 'archive-' => 'archive', 'search-' => 'search' ) as $prefix => $context ) {
			if ( 0 === strpos( $slug, $prefix ) ) {
				return array( $context );
			}
		}

		return array( 'home', 'singular', 'archive', 'search' );
	}

	/**
	 * A readable name for a template or template part.
	 *
	 * @param string $slug Template slug.
	 * @return string
	 */
	private function template_label( $slug ) {
		$slug = strtolower( (string) $slug );

		$labels = array(
			'front-page' => __( 'Front page template', 'titlesparks' ),
			'home'       => __( 'Posts page template', 'titlesparks' ),
			'index'      => __( 'Blog template', 'titlesparks' ),
			'single'     => __( 'Single post template', 'titlesparks' ),
			'singular'   => __( 'Single post template', 'titlesparks' ),
			'page'       => __( 'Page template', 'titlesparks' ),
			'archive'    => __( 'Archive template', 'titlesparks' ),
			'category'   => __( 'Category template', 'titlesparks' ),
			'tag'        => __( 'Tag template', 'titlesparks' ),
			'author'     => __( 'Author template', 'titlesparks' ),
			'search'     => __( 'Search results template', 'titlesparks' ),
			'404'        => __( '404 template', 'titlesparks' ),
			'sidebar'    => __( 'sidebar', 'titlesparks' ),
			'footer'     => __( 'footer', 'titlesparks' ),
			'header'     => __( 'header', 'titlesparks' ),
		);

		if ( isset( $labels[ $slug ] ) ) {
			return $labels[ $slug ];
		}

		foreach ( $labels as $prefix => $label ) {
			if ( 0 === strpos( $slug, $prefix . '-' ) ) {
				return $label;
			}
		}

		return '' === $slug
			? __( 'Template', 'titlesparks' )
			: ucwords( str_replace( array( '-', '_' ), ' ', $slug ) ) . ' template';
	}

	/**
	 * How many published items of one kind the scan reads.
	 *
	 * A site can hold thousands of posts, and parsing every one of them on the
	 * settings screen would make the page slow to open. Reading the most recent
	 * handful of each kind finds the layouts a site actually uses — the newest
	 * posts are the ones written with the current template — without walking the
	 * whole library. Sections are deduplicated by selector, so one copy of a
	 * block is enough to offer its switch.
	 *
	 * @var int
	 */
	private const CONTENT_SAMPLE_LIMIT = 5;

	/**
	 * How many published static pages the scan reads.
	 *
	 * Pages carry the hand-built layouts — an about page with a team list, a
	 * section front with a query loop, a landing page of feature cards — and a
	 * site usually has far fewer pages than posts, so a slightly wider sample
	 * costs little and finds more of them.
	 *
	 * @var int
	 */
	private const PAGE_SAMPLE_LIMIT = 10;

	/**
	 * The most items the scan reads across every post type.
	 *
	 * A site can register a dozen public post types; reading the most recent
	 * handful of each a few times over is still bounded work for the settings
	 * screen, but the cap keeps a plugin-heavy install from turning the scan into
	 * a page of its own.
	 *
	 * @var int
	 */
	private const TOTAL_SOURCE_LIMIT = 40;

	/**
	 * The site's own page and post content, as single-page sources.
	 *
	 * A classic theme's single-post and single-page layouts live in its PHP
	 * templates, which cannot be read, but whatever the author put in the item
	 * itself renders there — a related-posts block, a list of further reading, a
	 * query loop. Every public post type is read, not only the types icons are
	 * switched on for: a block on a product or a page still renders that item's
	 * post titles, so it is a real area even when its own type shows no icons.
	 *
	 * The label names the item, so the settings screen can say where a section
	 * was found instead of repeating "Recent post content" once per sample.
	 *
	 * @return array<int, array{label: string, contexts: string[], content: string}>
	 */
	private function content_sources() {
		$sources = array();
		$types   = $this->sample_post_types();

		foreach ( $types as $type ) {
			if ( count( $sources ) >= self::TOTAL_SOURCE_LIMIT ) {
				break;
			}

			$limit = 'page' === $type ? self::PAGE_SAMPLE_LIMIT : self::CONTENT_SAMPLE_LIMIT;

			// Queried directly rather than through `get_posts()`, whose own
			// defaults set `suppress_filters`: leaving it out of the arguments is
			// not enough to clear it, and a suppressed query hides the site's own
			// filtering from this read, so the scan would report sections from
			// items the reader is never served.
			$query = new \WP_Query(
				array(
					'post_type'      => $type,
					'post_status'    => 'publish',
					'posts_per_page' => $limit,
					'orderby'        => 'date',
					'order'          => 'DESC',
					'fields'         => 'ids',
					'no_found_rows'  => true,
				)
			);

			$ids = $query->posts;

			$object = get_post_type_object( $type );
			$kind   = $object && isset( $object->labels->singular_name )
				? (string) $object->labels->singular_name
				: ucwords( str_replace( array( '-', '_' ), ' ', $type ) );

			foreach ( is_array( $ids ) ? $ids : array() as $post_id ) {
				$post_id = (int) $post_id;
				$content = get_post_field( 'post_content', $post_id, 'raw' );

				if ( ! is_string( $content ) || '' === trim( $content ) ) {
					continue;
				}

				$title = trim( wp_strip_all_tags( (string) get_post_field( 'post_title', $post_id, 'raw' ) ) );

				$label = $kind;

				if ( '' !== $title ) {
					/* translators: 1: post type singular name, 2: item title. */
					$label = sprintf( __( '%1$s: %2$s', 'titlesparks' ), $kind, $title );
				}

				$sources[] = array(
					'label'    => $label,
					'contexts' => array( 'singular' ),
					'content'  => $content,
				);
			}
		}

		return $sources;
	}

	/**
	 * The post types whose recent content the scan reads.
	 *
	 * The icon-enabled types come first, then every other public type, then
	 * pages, which are always read because a page is a single page even when its
	 * own type is not one the author shows icons on. Attachments are left out:
	 * their content is not a layout a reader visits.
	 *
	 * @return string[]
	 */
	private function sample_post_types() {
		$types = $this->enabled_post_types();

		foreach ( get_post_types( array( 'public' => true ), 'names' ) as $type ) {
			$types[] = $type;
		}

		$types[] = 'page';

		$types = array_values(
			array_unique(
				array_filter(
					$types,
					static function ( $type ) {
						return 'attachment' !== $type && post_type_exists( $type );
					}
				)
			)
		);

		return $types;
	}

	/**
	 * Turn parsed blocks into homepage sections, walking nested blocks.
	 *
	 * One section is kept per selector: two copies of the same block share a
	 * class, so they also share the one setting, instead of producing duplicate
	 * checkboxes that cannot be told apart on the page. A targeted block is not
	 * walked into, so a query block does not also offer its inner post template
	 * as a second, contradictory switch.
	 *
	 * A synced pattern is walked into rather than offered as a section of its
	 * own: a `core/block` reference renders whatever the pattern holds, with no
	 * wrapper of its own, so a checkbox for it would gate nothing while the
	 * blocks inside it stayed out of the list. The referenced pattern's content
	 * is read and parsed exactly like nested blocks, with a guard against a
	 * pattern that includes itself.
	 *
	 * @param array              $blocks  Parsed blocks.
	 * @param array<string,bool> $seen    Selectors already claimed by a section.
	 * @param int                $depth   Nesting depth, to stop a malformed tree.
	 * @param array<int,bool>    $visited Synced pattern IDs already walked into.
	 * @return array<int, array{id: string, name: string, selectors: string[]}>
	 */
	private function sections_from_blocks( array $blocks, array &$seen, $depth = 0, array &$visited = array() ) {
		$sections = array();

		if ( $depth > 6 ) {
			return $sections;
		}

		foreach ( $blocks as $block ) {
			if ( ! is_array( $block ) || empty( $block['blockName'] ) || ! is_string( $block['blockName'] ) ) {
				continue;
			}

			if ( 'core/block' === $block['blockName'] ) {
				$sections = array_merge(
					$sections,
					$this->sections_from_pattern( $block, $seen, $depth, $visited )
				);

				continue;
			}

			$selector = $this->block_selector( $block );
			$anchor   = isset( $block['attrs']['anchor'] ) && is_string( $block['attrs']['anchor'] )
				? $block['attrs']['anchor']
				: '';
			$class    = isset( $block['attrs']['className'] ) && is_string( $block['attrs']['className'] )
				? $block['attrs']['className']
				: '';

			// A block that is targeted as a whole is not walked into: every
			// title inside it is already gated by its selector, so a nested
			// post list must not become a second checkbox that can contradict
			// the outer one. Untargeted layout containers are walked instead.
			$targeted = '' !== $selector && (
				'' !== $anchor ||
				'' !== $class ||
				! $this->is_structural_block( $block['blockName'] )
			);

			if ( $targeted && ! isset( $seen[ $selector ] ) ) {
				$seen[ $selector ] = true;
				$heading           = $this->heading_from_html(
					isset( $block['innerHTML'] ) ? (string) $block['innerHTML'] : ''
				);
				$sections[]        = array(
					'id'        => $this->block_section_id( $selector ),
					'name'      => '' !== $heading ? $heading : $this->block_type_title( $block['blockName'] ),
					'selectors' => array( $selector ),
				);
			}

			if ( ! $targeted && ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
				$sections = array_merge(
					$sections,
					$this->sections_from_blocks( $block['innerBlocks'], $seen, $depth + 1, $visited )
				);
			}
		}

		return $sections;
	}

	/**
	 * The sections inside a synced pattern a block references.
	 *
	 * A pattern can be edited on its own, so its blocks are read from the stored
	 * pattern at scan time rather than remembered. The pattern must be published
	 * and readable; anything else is skipped, as is a pattern already walked
	 * (a pattern may include a pattern, including one already in the chain).
	 *
	 * @param array              $block   The `core/block` block.
	 * @param array<string,bool> $seen    Selectors already claimed by a section.
	 * @param int                $depth   Nesting depth so far.
	 * @param array<int,bool>    $visited Pattern IDs already walked into.
	 * @return array<int, array{id: string, name: string, selectors: string[]}>
	 */
	private function sections_from_pattern( array $block, array &$seen, $depth, array &$visited ) {
		$ref = isset( $block['attrs']['ref'] ) ? (int) $block['attrs']['ref'] : 0;

		if ( $ref <= 0 || isset( $visited[ $ref ] ) ) {
			return array();
		}

		$pattern = get_post( $ref );

		if ( ! $pattern instanceof \WP_Post || 'wp_block' !== $pattern->post_type || 'publish' !== $pattern->post_status ) {
			return array();
		}

		$content = get_post_field( 'post_content', $ref, 'raw' );

		if ( ! is_string( $content ) || '' === trim( $content ) ) {
			return array();
		}

		$visited[ $ref ] = true;

		return $this->sections_from_blocks( parse_blocks( $content ), $seen, $depth + 1, $visited );
	}

	/**
	 * The CSS selector that targets one rendered block.
	 *
	 * An anchor or an author-written class is preferred because the author
	 * chose it and it survives a theme change. Otherwise the block's generated
	 * class is used, which WordPress renders from the block name.
	 *
	 * @param array $block Parsed block.
	 * @return string Selector, or an empty string when the block name is unusable.
	 */
	private function block_selector( array $block ) {
		$attrs = isset( $block['attrs'] ) && is_array( $block['attrs'] ) ? $block['attrs'] : array();

		if ( isset( $attrs['anchor'] ) && is_string( $attrs['anchor'] ) ) {
			$anchor = trim( $attrs['anchor'] );

			if ( preg_match( '/^[A-Za-z][A-Za-z0-9_-]*$/', $anchor ) ) {
				return '#' . $anchor;
			}
		}

		if ( isset( $attrs['className'] ) && is_string( $attrs['className'] ) ) {
			foreach ( preg_split( '/\s+/', trim( $attrs['className'] ) ) as $class ) {
				if ( '' !== $class && preg_match( '/^[A-Za-z][A-Za-z0-9_-]*$/', $class ) ) {
					return '.' . $class;
				}
			}
		}

		// WordPress drops the core namespace and flattens any other one when it
		// builds a block's default class: `core/latest-posts` renders as
		// `.wp-block-latest-posts`, while `acme/post-grid` renders as
		// `.wp-block-acme-post-grid`.
		$name = 0 === strpos( $block['blockName'], 'core/' )
			? substr( $block['blockName'], 5 )
			: str_replace( '/', '-', $block['blockName'] );

		return preg_match( '/^[a-z0-9-]+$/', $name ) ? '.wp-block-' . $name : '';
	}

	/**
	 * A stable, readable section ID for a scanned block.
	 *
	 * It is derived from the selector, not the block's position, so reordering
	 * the front page does not move a saved choice to a different block. An
	 * anchor, an author class and a generated block class cannot produce the
	 * same ID because the kind of selector is part of it.
	 *
	 * @param string $selector Selector the section gates on.
	 * @return string
	 */
	private function block_section_id( $selector ) {
		$first = substr( $selector, 0, 1 );
		$kind  = '#' === $first ? 'anchor' : 'class';
		$name  = Security::sanitize_key( substr( $selector, 1 ) );

		return 'page-' . $kind . '-' . $name;
	}

	/**
	 * Whether a block is layout rather than a place post titles appear.
	 *
	 * Containers are skipped so the list stays about content a reader can see
	 * titles in. A container the author anchored or classed is still offered, by
	 * `sections_from_blocks()`, because that choice is deliberate.
	 *
	 * @param string $block_name Block name.
	 * @return bool
	 */
	private function is_structural_block( $block_name ) {
		$structural = array(
			'core/buttons',
			'core/code',
			'core/column',
			'core/columns',
			'core/cover',
			'core/details',
			'core/embed',
			'core/file',
			'core/gallery',
			'core/group',
			'core/heading',
			'core/html',
			'core/image',
			'core/list',
			'core/media-text',
			'core/paragraph',
			'core/preformatted',
			'core/pullquote',
			'core/quote',
			'core/separator',
			'core/shortcode',
			'core/social-links',
			'core/spacer',
			'core/table',
			'core/template-part',
			'core/verse',
			'core/video',
		);

		return in_array( $block_name, $structural, true );
	}

	/**
	 * The registered name of a block, in words.
	 *
	 * Block types registered by WordPress and by plugins carry their own title,
	 * which is the name a reader sees in the inserter. When a type is not
	 * registered (a plugin that has since been disabled, for example) the block
	 * name is turned into words so the settings still say something meaningful
	 * instead of falling back to the generic "Block" label.
	 *
	 * @param string $block_name Block name, for example `core/latest-posts`.
	 * @return string
	 */
	private function block_type_title( $block_name ) {
		if ( '' === $block_name ) {
			return '';
		}

		if ( class_exists( '\WP_Block_Type_Registry' ) ) {
			$registry = \WP_Block_Type_Registry::get_instance();
			$type     = $registry ? $registry->get_registered( $block_name ) : null;

			if ( $type ) {
				$title = method_exists( $type, 'get_title' )
					? $type->get_title()
					: ( isset( $type->title ) ? $type->title : '' );

				if ( is_string( $title ) && '' !== trim( $title ) ) {
					return trim( $title );
				}
			}
		}

		return $this->humanize_block_name( $block_name );
	}

	/**
	 * Turn a block name into a readable label.
	 *
	 * `core/latest-posts` becomes `Latest Posts`, and a plugin block keeps its
	 * own name without the namespace, because the namespace is usually the
	 * plugin and not what the block does.
	 *
	 * @param string $block_name Block name.
	 * @return string
	 */
	private function humanize_block_name( $block_name ) {
		$name = (string) $block_name;
		$pos  = strpos( $name, '/' );

		if ( false !== $pos ) {
			$name = substr( $name, $pos + 1 );
		}

		$name = trim( preg_replace( '/\s+/', ' ', str_replace( array( '-', '_' ), ' ', $name ) ) );

		return '' === $name ? '' : ucwords( $name );
	}

	/**
	 * The first heading's text inside rendered block HTML, if any.
	 *
	 * @param string $html Rendered block HTML.
	 * @return string
	 */
	private function heading_from_html( $html ) {
		if ( ! is_string( $html ) || '' === $html ) {
			return '';
		}

		if ( preg_match( '/<h[1-6]\b[^>]*>(.*?)<\/h[1-6]>/is', $html, $match ) ) {
			return trim( wp_strip_all_tags( $match[1] ) );
		}

		return '';
	}

	/**
	 * IDs of active widgets whose homepage icon display has not been turned off.
	 *
	 * Unset choices default on so a newly added widget is available immediately.
	 *
	 * @return string[]
	 */
	public function enabled_home_widget_ids() {
		$choices = $this->widget_display();
		$enabled = array();

		foreach ( $this->active_widgets() as $widget ) {
			if ( ! isset( $choices[ $widget['id'] ] ) || $choices[ $widget['id'] ] ) {
				$enabled[] = $widget['id'];
			}
		}

		return $enabled;
	}

	/**
	 * Registered active widgets that can display post titles on the homepage.
	 *
	 * Only widgets actually assigned to active sidebars are returned. WordPress
	 * themes can register arbitrary widget callbacks, so this list describes the
	 * active sidebar/widget instances; it cannot discover hard-coded theme areas.
	 *
	 * Each widget also carries the page contexts of the sidebars it sits in,
	 * read from the theme's templates, so a sidebar printed only by a single-post
	 * template says so instead of looking like an everywhere control.
	 *
	 * A name two widgets share — two Search blocks in one sidebar — is suffixed
	 * with the instance ID, because the settings list identifies a row by that
	 * name alone and two identical labels would be one choice the reader cannot
	 * tell from the other. A name no other widget carries is left as it is.
	 *
	 * @return array<int, array{id: string, name: string, type: string, position: string, areas: string[], contexts: string[]}>
	 */
	public function active_widgets() {
		if ( null !== $this->active_widgets ) {
			return $this->active_widgets;
		}

		global $wp_registered_widgets, $wp_registered_sidebars;

		$sidebar_contexts = $this->sidebar_contexts();

		$widgets  = is_array( $wp_registered_widgets ) ? $wp_registered_widgets : array();
		$registered_sidebars = is_array( $wp_registered_sidebars ) ? $wp_registered_sidebars : array();
		// wp_get_sidebars_widgets() is private core API; read the option it
		// wraps instead, then ignore the storage-version marker.
		$sidebars = get_option( 'sidebars_widgets', array() );
		$sidebars = is_array( $sidebars ) ? $sidebars : array();

		unset( $sidebars['array_version'] );

		$found = array();

		foreach ( $sidebars as $sidebar_id => $widget_ids ) {
			if ( 'wp_inactive_widgets' === $sidebar_id || ! is_array( $widget_ids ) ) {
				continue;
			}

			// The sidebar's registered name is where the reader sees the
			// widget, so two "Recent Posts" in two widget areas stay apart.
			$area = isset( $registered_sidebars[ $sidebar_id ]['name'] ) && is_string( $registered_sidebars[ $sidebar_id ]['name'] )
				? trim( wp_strip_all_tags( $registered_sidebars[ $sidebar_id ]['name'] ) )
				: (string) $sidebar_id;

			foreach ( $widget_ids as $widget_id ) {
				if ( ! isset( $widgets[ $widget_id ] ) ) {
					continue;
				}

				$widget      = $widgets[ $widget_id ];
				$name        = isset( $widget['name'] ) ? $widget['name'] : $widget_id;
				$callback    = isset( $widget['callback'] ) ? $widget['callback'] : null;
				$widget_type = '';
				// Empty means "follow the post title's position". Only an
				// explicit, valid widget setting overrides it.
				$position = '';

				// Core and class-based widgets store their per-instance title in
				// the widget settings; the registry name is only the generic type.
				if (
					is_array( $callback ) &&
					isset( $callback[0] ) &&
					$callback[0] instanceof \WP_Widget
				) {
					$widget_object = $callback[0];
					$id_base       = $widget_object->id_base;
					$widget_type   = $id_base;
					$number        = (int) substr( $widget_id, strlen( $id_base ) + 1 );
					$instances     = $widget_object->get_settings();

					$instance = isset( $instances[ $number ] ) && is_array( $instances[ $number ] )
						? $instances[ $number ]
						: array();

					if ( 'block' === $id_base && ! empty( $instance['content'] ) ) {
						$name = $this->block_widget_name( parse_blocks( $instance['content'] ), $name );
					} elseif ( isset( $instance['title'] ) && is_string( $instance['title'] ) ) {
						$instance_title = trim( wp_strip_all_tags( $instance['title'] ) );

						if ( '' !== $instance_title ) {
							$name = $instance_title;
						}

						if (
							isset( $instance['position'] ) &&
							is_scalar( $instance['position'] ) &&
							in_array( (string) $instance['position'], Security::allowed_positions(), true )
						) {
							$position = Security::position( $instance['position'] );
						}
					} elseif ( ! empty( $widget['classname'] ) ) {
						$widget_type = $widget['classname'];
					}
				}

				$contexts = isset( $sidebar_contexts[ $sidebar_id ] ) && is_array( $sidebar_contexts[ $sidebar_id ] )
					? $sidebar_contexts[ $sidebar_id ]
					: array( 'all' );

				if ( isset( $found[ $widget_id ] ) ) {
					// One instance is assigned to several sidebars.
					if ( ! in_array( $area, $found[ $widget_id ]['areas'], true ) ) {
						$found[ $widget_id ]['areas'][] = $area;
					}

					// A sidebar a template prints without saying where is read as
					// everywhere; when one of the two does say, both count.
					if ( in_array( 'all', $found[ $widget_id ]['contexts'], true ) ) {
						$found[ $widget_id ]['contexts'] = $contexts;
					}

					if ( ! in_array( 'all', $contexts, true ) ) {
						$found[ $widget_id ]['contexts'] = array_values(
							array_unique( array_merge( $found[ $widget_id ]['contexts'], $contexts ) )
						);
					}

					continue;
				}

				$found[ $widget_id ] = array(
					'id'       => $widget_id,
					'name'     => $name,
					'type'     => $widget_type,
					'position' => $position,
					'areas'    => array( $area ),
					'contexts' => $contexts,
				);
			}
		}

		$this->active_widgets = array_values( $this->disambiguate_widget_names( $found ) );

		return $this->active_widgets;
	}

	/**
	 * Suffix the name of every widget whose name another widget also carries.
	 *
	 * WordPress names several widget types the same thing — every block widget
	 * is called "Block", every Search widget "Search" — and a sidebar can hold
	 * more than one of each. The instance ID is unique per widget and is what
	 * the rendered markup and the per-widget setting are keyed by, so it is the
	 * suffix that still means something after the list has been saved and read
	 * back. Names that occur once are returned untouched, so the common case
	 * stays readable.
	 *
	 * @param array<string, array> $found Widgets keyed by instance ID.
	 * @return array<string, array>
	 */
	private function disambiguate_widget_names( array $found ) {
		$names = array();

		foreach ( $found as $widget ) {
			$names[] = isset( $widget['name'] ) ? (string) $widget['name'] : '';
		}

		$counts = array_count_values( $names );

		foreach ( $found as $widget_id => $widget ) {
			$name = isset( $widget['name'] ) ? (string) $widget['name'] : '';

			if ( ! isset( $counts[ $name ] ) || $counts[ $name ] < 2 ) {
				continue;
			}

			$found[ $widget_id ]['name'] = sprintf(
				/* translators: 1: widget name, 2: the widget instance ID, e.g. block-7. */
				__( '%1$s (%2$s)', 'titlesparks' ),
				$name,
				(string) $widget_id
			);
		}

		return $found;
	}

	/**
	 * Active theme sections with saved display choices.
	 *
	 * The hook name and method name predate the template-wide scan, and are kept
	 * so an existing integration does not break. `contexts` says which pages the
	 * section renders on, so its switch only gates those pages; a section a theme
	 * registered through the filter without contexts is treated as everywhere,
	 * which is how those sections behaved before the list was widened.
	 *
	 * @return array<int, array{id: string, name: string, selectors: string[], contexts: string[], sources: string[], enabled: bool}>
	 */
	public function homepage_section_choices() {
		$choices  = $this->section_display();
		$sections = array();

		foreach ( $this->homepage_sections() as $section ) {
			if ( ! is_array( $section ) || empty( $section['id'] ) || empty( $section['name'] ) || empty( $section['selectors'] ) ) {
				continue;
			}

			$id        = Security::sanitize_key( $section['id'] );
			$selectors = array_values( array_filter( (array) $section['selectors'], 'is_string' ) );

			if ( '' === $id || ! $selectors ) {
				continue;
			}

			$contexts = isset( $section['contexts'] ) && is_array( $section['contexts'] )
				? array_values( array_filter( array_map( 'strval', $section['contexts'] ), 'strlen' ) )
				: array();
			$sources  = isset( $section['sources'] ) && is_array( $section['sources'] )
				? array_values( array_filter( array_map( 'strval', $section['sources'] ), 'strlen' ) )
				: array();

			$sections[] = array(
				'id'        => $id,
				'name'      => sanitize_text_field( $section['name'] ),
				'selectors' => $selectors,
				// No contexts means the section was registered by a theme that
				// expects it to work wherever it renders, so it keeps that reach.
				'contexts'  => $contexts ? $contexts : array( 'all' ),
				'sources'   => $sources,
				'enabled'   => ! isset( $choices[ $id ] ) || $choices[ $id ],
			);
		}

		return $sections;
	}

	/**
	 * The page contexts each active sidebar renders in, keyed by sidebar ID.
	 *
	 * A widget belongs to a sidebar, and a theme decides which template prints
	 * that sidebar. Reading the theme's own PHP files for `dynamic_sidebar()`
	 * and `is_active_sidebar()` calls is what turns "this widget" into "this
	 * widget on a post page, an archive or the front page". The files are read
	 * as text and never included, and a file that cannot be read is simply not
	 * counted, so a hardened host degrades this to "everywhere" rather than
	 * breaking the screen.
	 *
	 * A sidebar no template names keeps `all`, which is also what a theme that
	 * builds its sidebars dynamically gets: the plugin cannot run the theme to
	 * find out, and guessing a narrower answer would switch icons off on pages
	 * the widget does render on.
	 *
	 * @return array<string, string[]>
	 */
	private function sidebar_contexts() {
		if ( null !== $this->sidebar_contexts ) {
			return $this->sidebar_contexts;
		}

		$cached = get_transient( self::SIDEBAR_CONTEXTS_TRANSIENT );

		if ( is_array( $cached ) && ! $this->scan_is_stale() ) {
			$this->sidebar_contexts = $cached;

			return $this->sidebar_contexts;
		}

		if ( ! $this->may_scan() || ! $this->acquire_scan_lock() ) {
			$this->schedule_scan_rebuild();

			$this->sidebar_contexts = is_array( $cached ) ? $cached : array();

			return $this->sidebar_contexts;
		}

		$contexts = array();
		$read     = 0;

		foreach ( $this->theme_template_files() as $relative => $file ) {
			if ( $read >= self::THEME_TOTAL_MAX_BYTES ) {
				break;
			}

			/*
			 * A template file this site already owns, read to see which widget
			 * areas it registers. It is not a remote URL, so the HTTP API has
			 * nothing to offer here; the path comes from the theme itself.
			 */
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			$contents = @file_get_contents( $file );

			if ( ! is_string( $contents ) || '' === $contents ) {
				continue;
			}

			$read += strlen( $contents );

			$ids = array();

			foreach ( array( 'dynamic_sidebar', 'is_active_sidebar' ) as $function ) {
				if ( preg_match_all( '/' . $function . '\s*\(\s*[\'"]([A-Za-z0-9_-]+)[\'"]/', $contents, $matches ) ) {
					$ids = array_merge( $ids, $matches[1] );
				}
			}

			if ( ! $ids ) {
				continue;
			}

			$file_contexts = $this->template_file_contexts( $relative );

			foreach ( array_unique( $ids ) as $sidebar_id ) {
				if ( ! isset( $contexts[ $sidebar_id ] ) ) {
					$contexts[ $sidebar_id ] = $file_contexts;

					continue;
				}

				if ( in_array( 'all', $contexts[ $sidebar_id ], true ) ) {
					$contexts[ $sidebar_id ] = $file_contexts;

					continue;
				}

				if ( ! in_array( 'all', $file_contexts, true ) ) {
					$contexts[ $sidebar_id ] = array_values(
						array_unique( array_merge( $contexts[ $sidebar_id ], $file_contexts ) )
					);
				}
			}
		}

		$this->sidebar_contexts = $contexts;

		set_transient( self::SIDEBAR_CONTEXTS_TRANSIENT, $contexts, WEEK_IN_SECONDS );

		$this->release_scan_lock();

		return $this->sidebar_contexts;
	}

	/**
	 * The theme's PHP files, keyed by their path below the theme directory.
	 *
	 * The active theme and its parent are both read, so a child theme that
	 * prints a parent theme's sidebar is still understood. The walk is bounded
	 * by a file count and a size, so a theme with a built asset directory in it
	 * cannot turn this into a crawl of the whole install.
	 *
	 * @return array<string, string> Relative path => absolute path.
	 */
	private function theme_template_files() {
		$directories = array( get_template_directory() );
		$stylesheet  = get_stylesheet_directory();

		if ( $stylesheet !== $directories[0] ) {
			$directories[] = $stylesheet;
		}

		$files = array();

		foreach ( $directories as $directory ) {
			if ( ! is_dir( $directory ) ) {
				continue;
			}

			$iterator = new \RecursiveIteratorIterator(
				new \RecursiveDirectoryIterator( $directory, \FilesystemIterator::SKIP_DOTS )
			);

			foreach ( $iterator as $file ) {
				if ( count( $files ) >= self::THEME_FILE_LIMIT ) {
					break 2;
				}

				if ( ! $file->isFile() || 'php' !== strtolower( $file->getExtension() ) ) {
					continue;
				}

				if ( $file->getSize() > self::THEME_FILE_MAX_BYTES ) {
					continue;
				}

				$path = str_replace( '\\', '/', $file->getPathname() );
				$name = ltrim( (string) substr( $path, strlen( str_replace( '\\', '/', $directory ) ) ), '/' );

				if ( '' === $name || preg_match( '#(^|/)(node_modules|vendor|\.git|build|dist)/#', $name ) ) {
					continue;
				}

				$files[ $name ] = $path;
			}
		}

		return $files;
	}

	/**
	 * The page contexts one theme file renders in, read from its name.
	 *
	 * This follows WordPress's own template hierarchy: `single-news.php` serves
	 * one post, `archive-news.php` a listing, `front-page.php` the front page,
	 * `search.php` the results, and `index.php` — or the shared files a template
	 * pulls in through `get_sidebar()` and `get_footer()` — can serve any of
	 * them. A file under `template-parts/` or `parts/` is included by another
	 * template, so it is read as everywhere rather than guessed at.
	 *
	 * @param string $relative Path below the theme directory.
	 * @return string[] `home`, `singular`, `archive`, `search` or `all`.
	 */
	private function template_file_contexts( $relative ) {
		$relative = strtolower( str_replace( '\\', '/', (string) $relative ) );

		if ( false !== strpos( $relative, '/' ) ) {
			// A file in a subdirectory is included by a template rather than
			// picked by the hierarchy, unless it is one of the names index.php
			// and WordPress both resolve.
			$directory = strtok( $relative, '/' );

			if ( in_array( $directory, array( 'template-parts', 'parts', 'inc', 'includes', 'templates' ), true ) ) {
				return array( 'all' );
			}
		}

		$contexts = $this->template_contexts( basename( $relative, '.php' ) );

		// A shared file the hierarchy resolves everywhere is one answer, not
		// four, so the settings screen says "Every page" for it.
		if ( 4 === count( $contexts ) ) {
			return array( 'all' );
		}

		return $contexts;
	}

	/**
	 * The most readable name for a block widget's content.
	 *
	 * The whole widget is scanned, nested blocks included: a Search block in a
	 * Group still says Search. A block's own heading wins (it is what a reader
	 * sees), then the registered block title, then the block name in words. The
	 * widget registry's name is only used when the content has no blocks at all.
	 *
	 * @param array  $blocks   Parsed block data.
	 * @param string $fallback Registered widget name.
	 * @return string Human-readable name.
	 */
	private function block_widget_name( array $blocks, $fallback ) {
		foreach ( $blocks as $block ) {
			if ( ! is_array( $block ) ) {
				continue;
			}

			$name = $this->block_name( $block );

			if ( '' !== $name ) {
				return $name;
			}
		}

		return '' !== $fallback ? $fallback : __( 'Block', 'titlesparks' );
	}

	/**
	 * The readable name of one parsed block.
	 *
	 * @param array $block Parsed block.
	 * @return string Empty when the block has nothing to name it with.
	 */
	private function block_name( array $block ) {
		$heading = $this->heading_from_html(
			isset( $block['innerHTML'] ) ? (string) $block['innerHTML'] : ''
		);

		if ( '' !== $heading ) {
			return $heading;
		}

		if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
			foreach ( $block['innerBlocks'] as $inner_block ) {
				if ( ! is_array( $inner_block ) ) {
					continue;
				}

				$inner_name = $this->block_name( $inner_block );

				if ( '' !== $inner_name ) {
					return $inner_name;
				}
			}
		}

		$block_name = isset( $block['blockName'] ) && is_string( $block['blockName'] )
			? $block['blockName']
			: '';

		// A block widget can hold a synced pattern, which renders whatever
		// the pattern holds. Its own post title is the name a reader knows it
		// by, and it is more useful than the generic `core/block` type name.
		if ( 'core/block' === $block_name ) {
			$ref = isset( $block['attrs']['ref'] ) ? (int) $block['attrs']['ref'] : 0;

			if ( $ref > 0 ) {
				// Raw field, so naming a widget cannot run the title filters.
				$pattern_title = trim( (string) get_post_field( 'post_title', $ref, 'raw' ) );

				if ( '' !== $pattern_title ) {
					return $pattern_title;
				}
			}
		}

		return $this->block_type_title( $block_name );
	}

	/**
	 * Whether a given post type may use the feature.
	 *
	 * @param string $post_type Post type name.
	 * @return bool
	 */
	public function is_post_type_enabled( $post_type ) {
		if ( ! $this->is_enabled() ) {
			return false;
		}

		return in_array( $post_type, $this->enabled_post_types(), true );
	}

	/**
	 * The anchor a timeline should resolve from, on the site clock.
	 *
	 * A timeline that carries its own anchor keeps it: it was either saved
	 * before this setting existed, or set deliberately for one post. Otherwise a
	 * site configured to start every timeline on a fixed date returns that date,
	 * and `post` (or an unusable fixed value) returns an empty string, which the
	 * decay maths reads as "use the post's publish date".
	 *
	 * @param array $timeline Sanitized timeline.
	 * @return string `Y-m-d H:i:s` on the site clock, or '' for the post date.
	 */
	public function anchor_for( array $timeline ) {
		if ( ! empty( $timeline['anchor'] ) ) {
			return $timeline['anchor'];
		}

		if ( 'fixed' === $this->get( 'anchor_source', 'post' ) ) {
			return Security::anchor( $this->get( 'anchor_datetime', '' ) );
		}

		return '';
	}

	/**
	 * Persist a settings payload.
	 *
	 * @param array $data Raw (already permission-checked) settings data.
	 * @return array The sanitized settings that were stored.
	 */
	public function update( array $data ) {
		$clean = Security::settings( $data );

		update_option( self::OPTION, $clean );

		$this->cache            = null;
		$this->scanned_sections = null;
		$this->sidebar_contexts = null;
		$this->active_widgets   = null;

		/**
		 * Fires after the global settings are stored.
		 *
		 * @param array $clean Sanitized settings.
		 */
		do_action( 'titlesparks_settings_saved', $clean );

		return $clean;
	}

	/**
	 * Insert the defaults when the option does not exist yet.
	 *
	 * Called on activation only; an existing row is never overwritten.
	 *
	 * @return void
	 */
	public function ensure_defaults() {
		if ( false === get_option( self::OPTION, false ) ) {
			add_option( self::OPTION, $this->defaults() );
		}
	}

	/**
	 * Forget the in-request cache.
	 *
	 * @return void
	 */
	public function flush_cache() {
		$this->cache             = null;
		$this->scanned_sections  = null;
		$this->sidebar_contexts  = null;
		$this->active_widgets    = null;
	}
}
