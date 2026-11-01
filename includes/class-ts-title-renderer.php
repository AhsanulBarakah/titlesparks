<?php
/**
 * Front end title rendering.
 *
 * Resolves which icon a post should show and passes the data to the front end
 * script. Title strings are always returned unchanged; DOM placement keeps
 * theme markup, attributes, feeds, and secondary title reads safe.
 *
 * @package Title_Sparks
 */

namespace Title_Sparks;

use Title_Sparks\Security;
use Title_Sparks\Traits\Assets;

defined( 'ABSPATH' ) || exit;

/**
 * Class Title_Renderer
 */
final class Title_Renderer {

	use Assets;

	/** Bundle directory produced by `npm run build-frontend`. */
	const BUNDLE = 'build-frontend';

	/** Shared handle for the front end stylesheet and script. */
	const SCRIPT_HANDLE = 'titlesparks-title-icons';

	/** Global the front end script reads its instructions from. */
	const DATA_GLOBAL = 'titleSparksFrontendData';

	/**
	 * Post meta store.
	 *
	 * @var Post_Meta
	 */
	private $meta;

	/**
	 * Asset library.
	 *
	 * @var Asset_Library
	 */
	private $library;

	/**
	 * Settings store.
	 *
	 * @var Settings
	 */
	private $settings;

	/**
	 * One entry per eligible post on this page.
	 *
	 * @var array<int,array>
	 */
	private $icons = array();

	/**
	 * Posts already asked about.
	 *
	 * A post with no icon at all is the common case on most pages, and without
	 * this it would be resolved again on every title read — the same option,
	 * meta and asset lookups, per copy of the title in a listing. This keeps the
	 * "no icon" answer beside `icons`, which stays a list of real entries because
	 * it is handed to the front end script.
	 *
	 * @var array<int,bool>
	 */
	private $checked = array();

	/**
	 * Constructor.
	 *
	 * @param Post_Meta|null     $meta     Optional meta store.
	 * @param Asset_Library|null $library  Optional asset library.
	 * @param Settings|null      $settings Optional settings store.
	 */
	public function __construct( ?Post_Meta $meta = null, ?Asset_Library $library = null, ?Settings $settings = null ) {
		$this->meta     = $meta ? $meta : new Post_Meta();
		$this->library  = $library ? $library : new Asset_Library();
		$this->settings = $settings ? $settings : Settings::instance();
	}

	/** Register the front end hooks. */
	public function register() {
		add_filter( 'the_title', array( $this, 'filter_title' ), 10, 2 );
		add_action( 'the_post', array( $this, 'record_post' ) );
		add_filter( 'dynamic_sidebar_params', array( $this, 'mark_enabled_widget' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );
		add_action( 'wp_footer', array( $this, 'enqueue_script' ), 5 );
	}

	/**
	 * Collect icon data when WordPress reads an eligible title, without changing it.
	 *
	 * @param string $title   Post title.
	 * @param int    $post_id Post ID.
	 * @return string The title, unchanged.
	 */
	public function filter_title( $title, $post_id = 0 ) {
		$this->record_post_id( absint( $post_id ) );

		return $title;
	}

	/**
	 * Collect an eligible entry at the beginning of a WordPress loop iteration.
	 *
	 * This also covers themes that print a raw post title without calling
	 * `the_title()`.
	 *
	 * @param \\WP_Post $post Current loop post.
	 * @return void
	 */
	public function record_post( $post ) {
		if ( $post instanceof \WP_Post ) {
			$this->record_post_id( absint( $post->ID ) );
		}
	}

	/**
	 * Store an eligible post entry once.
	 *
	 * @param int $post_id Post ID.
	 * @return void
	 */
	private function record_post_id( $post_id ) {
		if ( isset( $this->checked[ $post_id ] ) ) {
			return;
		}

		$this->checked[ $post_id ] = true;

		$entry = $this->entry_for( $post_id );

		if ( $entry ) {
			$this->icons[ $post_id ] = $entry;
		}
	}

	/**
	 * Whether a theme section renders on the page being served.
	 *
	 * A template part can be printed by any template, and a theme that
	 * registered its own section through the filter may not say where it
	 * appears, so both are read as "everywhere".
	 *
	 * @param array  $section  Section from the settings store.
	 * @param string $location `home`, `singular`, `archive` or `search`.
	 * @return bool
	 */
	private function section_applies_here( array $section, $location ) {
		$contexts = isset( $section['contexts'] ) && is_array( $section['contexts'] )
			? $section['contexts']
			: array( 'all' );

		return in_array( 'all', $contexts, true ) || in_array( $location, $contexts, true );
	}

	/**
	 * Whether any theme section's switch permits icons on this request.
	 *
	 * The front end script is only printed when something could use it, so this
	 * asks the same question `entry_for()` asks, for the page actually served.
	 *
	 * @return bool
	 */
	private function sections_may_render() {
		$location  = $this->display_location();
		$locations = $this->settings->display_locations();

		if ( empty( $locations[ $location ] ) ) {
			return false;
		}

		foreach ( $this->settings->homepage_section_choices() as $section ) {
			if ( $this->section_applies_here( $section, $location ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Add the widget instance ID and current checkbox state to a widget wrapper.
	 *
	 * It also marks disabled instances so generic featured-title discovery will
	 * not apply the checkbox-independent homepage option to their links.
	 *
	 * @param array $params Sidebar widget parameters.
	 * @return array Updated parameters.
	 */
	public function mark_enabled_widget( $params ) {
		if ( ! is_array( $params ) || ! isset( $params[0]['widget_id'], $params[0]['before_widget'] ) ) {
			return $params;
		}

		$widget_id  = $params[0]['widget_id'];
		$widget     = null;
		$active_ids = $this->settings->active_widgets();

		foreach ( $active_ids as $active_widget ) {
			if ( $widget_id === $active_widget['id'] ) {
				$widget = $active_widget;
				break;
			}
		}

		if ( ! $widget ) {
			return $params;
		}

		// A widget's own default follows the page it renders on, so the archive
		// setting covers a sidebar on a listing or a search results page.
		$widget_location   = $this->display_location();
		$location_defaults = $this->settings->display_locations();
		$widget_choices    = $this->settings->widget_display();
		$site_default      = ! empty( $location_defaults[ $widget_location ] ) &&
			( ! isset( $widget_choices[ $widget_id ] ) || $widget_choices[ $widget_id ] );

		$before_widget = (string) $params[0]['before_widget'];

		if ( false !== strpos( $before_widget, 'data-titlesparks-widget=' ) ) {
			return $params;
		}

		$marker = sprintf(
			' data-titlesparks-widget="%1$s" data-titlesparks-widget-enabled="%2$s"',
			esc_attr( $widget_id ),
			$site_default ? '1' : '0'
		);

		// Only advertise an explicit widget position. Without one the widget
		// follows the post title's position and offsets instead of silently
		// falling back to the old hardcoded `right`.
		if ( isset( $widget['position'] ) && is_string( $widget['position'] ) && '' !== $widget['position'] ) {
			$marker .= sprintf(
				' data-titlesparks-widget-position="%s"',
				esc_attr( $widget['position'] )
			);
		}

		if ( preg_match( '/^(\\s*<[a-zA-Z][a-zA-Z0-9:-]*)/', $before_widget ) ) {
			$params[0]['before_widget'] = preg_replace(
				'/^(\\s*<[a-zA-Z][a-zA-Z0-9:-]*)/',
				'$1' . $marker,
				$before_widget,
				1
			);
		} else {
			// Preserve a placeholder-based wrapper; some themes sprintf it after
			// the dynamic_sidebar_params filter runs.
			$params[0]['before_widget'] .= $marker;
		}

		return $params;
	}

	/**
	 * Which display location the current request belongs to.
	 *
	 * Every front end request that can print a post title resolves to one of the
	 * settings. Search results have a switch of their own, because a site often
	 * wants icons on its archives and a plainer results page; any other context
	 * — a 404 whose template lists posts, for instance — is a listing, and
	 * follows the archive setting. Every context therefore resolves to one of
	 * the four, so no page is left without an answer.
	 *
	 * @return string `home`, `singular`, `archive` or `search`.
	 */
	private function display_location() {
		if ( is_front_page() || is_home() ) {
			return 'home';
		}

		if ( is_singular() ) {
			return 'singular';
		}

		if ( is_search() ) {
			return 'search';
		}

		return 'archive';
	}

	/**
	 * Whether a post-level display choice permits one output, honoring the
	 * corresponding site default when the author chooses "Use site setting".
	 *
	 * @param array $timeline   Sanitized post timeline.
	 * @param string $group     Display choice group.
	 * @param string $key       Location, section ID, or widget ID.
	 * @param bool $siteDefault Site-wide choice for the output.
	 * @return bool
	 */
	private function post_output_enabled( array $timeline, $group, $key, $siteDefault ) {
		$display = isset( $timeline['display'][ $group ] ) && is_array( $timeline['display'][ $group ] )
			? $timeline['display'][ $group ]
			: array();
		$choice = isset( $display[ $key ] ) ? $display[ $key ] : 'inherit';

		return Security::resolves_post_display( $choice, $siteDefault );
	}

	/**
	 * Resolve one post's icon data, or null when it should not enter the page.
	 *
	 * Only a post a reader can open is described here: the entry carries the
	 * post's title and permalink, so a draft, a private post or a post in a
	 * post type that is not publicly viewable must never be exposed.
	 *
	 * @param int $post_id Post ID.
	 * @return array<string,mixed>|null
	 */
	private function entry_for( $post_id ) {
		if ( ! $post_id || is_admin() || is_feed() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
			return null;
		}

		if ( ! is_post_publicly_viewable( $post_id ) || post_password_required( $post_id ) ) {
			return null;
		}

		if ( ! $this->settings->is_enabled() || ! $this->settings->is_post_type_enabled( get_post_type( $post_id ) ) ) {
			return null;
		}

		$timeline = $this->meta->get( $post_id );

		if ( empty( $timeline['enabled'] ) ) {
			return null;
		}

		$anchor = $this->settings->anchor_for( $timeline );
		$stages = array();

		foreach ( Decay::stage_boundaries( $timeline, $post_id, $anchor ) as $boundary ) {
			$stage_data = $this->stage_payload( $timeline, $boundary['stage'] );

			$stages[] = array_merge(
				array(
					'stage' => (int) $boundary['stage'],
					'start' => (int) $boundary['start'],
					'end'   => (int) $boundary['end'],
				),
				$stage_data ? $stage_data : array()
			);
		}

		// The stage live at render time fills the entry's own fields. A cached
		// page picks its stage from `stages` instead, so the entry stays correct
		// for as long as it is cached; these fields are what a payload without
		// them is drawn from.
		$resolved   = Decay::resolve( $timeline, $post_id, 0, $anchor );
		$stage_data = (int) $resolved['stage'] > 0
			? $this->stage_payload( $timeline, (int) $resolved['stage'] )
			: null;

		if ( ! $stage_data ) {
			// Nothing is live (a fully elapsed `remove` timeline), so the first
			// stage that has an icon describes the entry and the browser decides
			// whether any icon is drawn at all.
			foreach ( $stages as $row ) {
				if ( ! empty( $row['url'] ) ) {
					$stage_data = $this->stage_payload( $timeline, (int) $row['stage'] );

					break;
				}
			}
		}

		if ( ! $stage_data ) {
			return null;
		}

		$url      = $stage_data['url'];
		$position = $stage_data['position'];
		$offsets  = Security::offsets( isset( $timeline['position_offsets'] ) ? $timeline['position_offsets'] : array() );
		$size     = $stage_data['size'];
		$mode     = $stage_data['sizeMode'];
		$location = $this->display_location();
		$location_defaults = $this->settings->display_locations();
		$allow_titles      = '' !== $location && $this->post_output_enabled(
			$timeline,
			'locations',
			$location,
			isset( $location_defaults[ $location ] ) ? $location_defaults[ $location ] : false
		);
		$entry = array(
			'id'          => $post_id,
			'title'       => $this->title_text( $post_id ),
			'permalink'   => (string) get_permalink( $post_id ),
			'url'         => $url,
			// A still copy of an animated icon, sent only when the site has
			// offered one. The script swaps it in for a reader whose system
			// asks for less motion; CSS cannot pause a GIF by itself.
			'still'       => $stage_data['still'],
			'size'        => $size,
			'position'    => $position,
			// A title-following icon is sized from bands once the script
			// measures the title; the size above is only what the page shows
			// before that, and for a fixed icon it is the real size. Advanced
			// carries the stage's own table, or the site's when it has none.
			'sizeMode'    => $mode,
			'sizingRules' => $stage_data['sizingRules'],
			'offsetX'     => (int) $offsets[ $position ]['x'],
			'offsetY'     => (int) $offsets[ $position ]['y'],
			// The editor and the page mirror the same stage the same way.
			'flip'            => $stage_data['flip'],
			'stage'           => (int) $resolved['stage'],
			'remaining'       => (int) $resolved['remaining'],
			'alt'             => $stage_data['alt'],
			// Every stage's boundaries and icon, so a page that is cached for
			// hours still shows the stage a reader should see: the browser
			// compares these with its own clock. `stage3Behaviour` says what
			// happens once the last stage has elapsed.
			'stages'          => $stages,
			'stage3Behaviour' => Security::behaviour( isset( $timeline['stage_3_behaviour'] ) ? $timeline['stage_3_behaviour'] : '' ),
			// This post's own answer for how its icon sits on its title, so a
			// card on a listing page honours the same choice as the article.
			'iconAnchor'  => $this->settings->icon_anchor_for( $timeline ),
			'iconSpacing' => $this->settings->icon_spacing_for( $timeline ),
			'singular'    => is_singular() && (int) get_queried_object_id() === $post_id,
			'allowTitles' => $allow_titles,
		);

		$sectionIds       = array();
		$sectionSelectors = array();

		/*
		 * A scanned section knows which pages its template renders on, so its
		 * switch gates exactly those pages: turning it off leaves the section's
		 * copies undecorated on every page the template renders on.
		 */
		$sections        = $this->settings->homepage_section_choices();
		$section_choices = $this->settings->section_display();

		foreach ( $sections as $section ) {
			if ( ! $this->section_applies_here( $section, $location ) ) {
				continue;
			}

			$id                      = $section['id'];
			$sectionSelectors[ $id ] = $section['selectors'];
			$site_default            = ! empty( $location_defaults[ $location ] ) &&
				( ! isset( $section_choices[ $id ] ) || $section_choices[ $id ] );

			if ( $this->post_output_enabled( $timeline, 'sections', $id, $site_default ) ) {
				$sectionIds[] = $id;
			}
		}

		if ( $sectionSelectors ) {
			$entry['sectionIds']       = $sectionIds;
			$entry['sectionSelectors'] = $sectionSelectors;
		}

		$widget_ids       = array();
		$widget_positions = array();
		$widget_offsets   = array();

		$entry['marker'] = 'widget-' . $post_id;
		$widgets         = $this->settings->active_widgets();
		$widget_choices  = $this->settings->widget_display();
		$widget_location = $this->display_location();

		foreach ( $widgets as $widget ) {
			// A sidebar the theme prints only on some pages is only offered
			// there, so a widget's switch follows the pages it actually renders
			// on instead of standing for every page.
			$widget_contexts = isset( $widget['contexts'] ) && is_array( $widget['contexts'] )
				? $widget['contexts']
				: array( 'all' );

			if ( ! in_array( 'all', $widget_contexts, true ) && ! in_array( $widget_location, $widget_contexts, true ) ) {
				continue;
			}

			$id           = $widget['id'];
			$site_default = ! empty( $location_defaults[ $widget_location ] ) &&
				( ! isset( $widget_choices[ $id ] ) || $widget_choices[ $id ] );

			if ( $this->post_output_enabled( $timeline, 'widgets', $id, $site_default ) ) {
				$widget_ids[] = $id;

				// An empty position means the widget inherits the post title's
				// position and offsets, so the frontend has nothing to override.
				if ( ! empty( $widget['position'] ) ) {
					$widget_position = Security::position( $widget['position'] );

					$widget_positions[ $id ] = $widget_position;
					$widget_offsets[ $id ]   = $offsets[ $widget_position ];
				}
			}
		}

		if ( $widget_ids ) {
			$entry['widgetIds'] = $widget_ids;

			if ( $widget_positions ) {
				$entry['widgetPositions'] = $widget_positions;
				$entry['widgetOffsets']   = $widget_offsets;
			}
		}

		if ( ! $allow_titles && ! $sectionIds && ! $widget_ids ) {
			return null;
		}

		return $entry;
	}

	/**
	 * One stage's icon data, or null when the stage has nothing to draw.
	 *
	 * The entry's own fields and its `stages` list are filled from here, so the
	 * stage the server saw at render time and the one the browser picks from a
	 * cached page are described by exactly the same values.
	 *
	 * @param array $timeline     Sanitized timeline.
	 * @param int   $stage_number Stage number (1-3).
	 * @return array{url:string,still:string,size:string,sizeMode:string,sizingRules:array,position:string,offsetX:int,offsetY:int,flip:bool,alt:string}|null
	 */
	private function stage_payload( array $timeline, $stage_number ) {
		$key   = 'stage_' . (int) $stage_number;
		$stage = isset( $timeline[ $key ] ) ? $timeline[ $key ] : array();
		$asset = $this->library->get( isset( $stage['asset_id'] ) ? $stage['asset_id'] : '' );

		if ( ! $asset || empty( $asset['url'] ) ) {
			return null;
		}

		$url = Security::image_url( $asset['url'] );

		if ( '' === $url ) {
			return null;
		}

		$position = Security::position( isset( $stage['position'] ) ? $stage['position'] : '' );
		$offsets  = Security::offsets( isset( $timeline['position_offsets'] ) ? $timeline['position_offsets'] : array() );
		$mode     = Security::size_mode( isset( $stage['size_mode'] ) ? $stage['size_mode'] : '' );

		return array(
			'url'         => $url,
			// A still copy of an animated icon, sent only when the site has
			// offered one. The script swaps it in for a reader whose system
			// asks for less motion; CSS cannot pause a GIF by itself.
			'still'       => $this->settings->reduced_motion() ? $this->library->still_url( $asset ) : '',
			'size'        => $this->stage_size( $stage, $asset ),
			'sizeMode'    => $mode,
			'sizingRules' => 'advanced' === $mode ? $this->stage_sizing_rules( $stage ) : $this->settings->sizing_rules(),
			'position'    => $position,
			'offsetX'     => (int) $offsets[ $position ]['x'],
			'offsetY'     => (int) $offsets[ $position ]['y'],
			'flip'        => ! empty( $stage['flip'] ),
			// The filter is told which stage's picture it is describing, so an
			// alt that names the stage stays right on a cached page.
			'alt'         => $this->alt_text(
				$asset,
				array(
					'stage'     => (int) $stage_number,
					'expired'   => false,
					'remaining' => 0,
				)
			),
		);
	}

	/**
	 * The title as the theme renders it.
	 *
	 * @param int $post_id Post ID.
	 * @return string
	 */
	private function title_text( $post_id ) {
		$raw = (string) get_post_field( 'post_title', $post_id, 'raw' );

		return convert_chars( wptexturize( $raw ) );
	}

	/**
	 * Build icon markup for a timeline. Used by editor previews.
	 *
	 * @param array $timeline Sanitized timeline.
	 * @param int   $post_id  Post ID.
	 * @param int   $now      Optional timestamp.
	 * @return string
	 */
	public function render_for_timeline( array $timeline, $post_id = 0, $now = 0 ) {
		$resolved = Decay::resolve( $timeline, $post_id, $now, Settings::instance()->anchor_for( $timeline ) );

		if ( Decay::STAGE_EXPIRED === $resolved['stage'] ) {
			return '';
		}

		$key   = 'stage_' . $resolved['stage'];
		$stage = isset( $timeline[ $key ] ) ? $timeline[ $key ] : array();
		$asset = $this->library->get( isset( $stage['asset_id'] ) ? $stage['asset_id'] : '' );

		if ( ! $asset || empty( $asset['url'] ) ) {
			return '';
		}

		$position = Security::position( isset( $stage['position'] ) ? $stage['position'] : '' );
		$offsets  = Security::offsets( isset( $timeline['position_offsets'] ) ? $timeline['position_offsets'] : array() );
		$size     = $this->stage_size( $stage, $asset );

		return $this->icon_markup(
			$asset,
			$position,
			$resolved,
			$offsets[ $position ],
			$size,
			! empty( $stage['flip'] )
		);
	}

	/**
	 * The rendered size of a stage, in fixed or title-relative mode.
	 *
	 * A title-following icon is sized from the bands only once the script has
	 * measured the title's font size, which PHP cannot know. Until then it is
	 * drawn at roughly the default ladder's proportion, so a page that has not
	 * run the script yet still shows an icon of about the right size instead of
	 * a full-size one — and the script overwrites the width on its first pass.
	 *
	 * @param array $stage Timeline stage.
	 * @param array $asset Library asset.
	 * @return string Safe CSS length.
	 */
	private function stage_size( array $stage, array $asset ) {
		$mode = Security::size_mode( isset( $stage['size_mode'] ) ? $stage['size_mode'] : '' );

		if ( 'advanced' === $mode ) {
			return '0.75em';
		}

		return Security::icon_size(
			isset( $stage['size'] ) ? $stage['size'] : '',
			isset( $asset['size'] ) ? $asset['size'] : ''
		);
	}

	/**
	 * The bands a stage's title-following icon is sized from.
	 *
	 * A stage without a table of its own follows the site's, which is what every
	 * stage did before it could carry one. Resolved here so the script receives
	 * the answer rather than a second copy of the fallback rule.
	 *
	 * @param array $stage Timeline stage.
	 * @return array<int,array{font:int,icon:int}>
	 */
	private function stage_sizing_rules( array $stage ) {
		$rules = Security::stage_sizing_rules( isset( $stage['sizing_rules'] ) ? $stage['sizing_rules'] : array() );

		return $rules ? $rules : $this->settings->sizing_rules();
	}

	/**
	 * Escaped `<img>` markup for one asset.
	 *
	 * @param array  $asset    Library asset.
	 * @param string $position Position keyword.
	 * @param array  $resolved Decay result, used for data attributes.
	 * @param array  $offset   `{ x, y }` nudge for this position, in pixels.
	 * @param string $size     CSS length the icon is drawn at.
	 * @param bool   $flip     Whether the icon is mirrored horizontally.
	 * @return string
	 */
	private function icon_markup( array $asset, $position, array $resolved, array $offset, $size, $flip = false ) {
		$url = Security::image_url( isset( $asset['url'] ) ? $asset['url'] : '' );

		if ( '' === $url ) {
			return '';
		}

		$classes = array(
			'titlesparks-icon',
			'titlesparks-icon--' . $position,
			'titlesparks-icon--flow',
		);

		if ( $flip ) {
			$classes[] = 'titlesparks-icon--flipped';
		}
		$style      = 'width:' . $size . ';height:auto;';
		$span_style = ' style="' . esc_attr( 'width:' . $size . ';' ) . '"';

		return sprintf(
			'<span class="%1$s" data-titlesparks-stage="%2$d" data-titlesparks-remaining="%3$d"' .
				' data-titlesparks-offset-x="%8$d" data-titlesparks-offset-y="%9$d"%7$s>' .
				'<img src="%4$s" alt="%5$s" class="titlesparks-icon__img" style="%6$s" loading="lazy" decoding="async" />' .
				'</span>',
			esc_attr( implode( ' ', $classes ) ),
			(int) $resolved['stage'],
			(int) $resolved['remaining'],
			esc_url( $url ),
			esc_attr( $this->alt_text( $asset, $resolved ) ),
			esc_attr( $style ),
			$span_style,
			(int) $offset['x'],
			(int) $offset['y']
		);
	}

	/**
	 * Accessible alt text for the icon.
	 *
	 * @param array $asset    Library asset.
	 * @param array $resolved Decay result.
	 * @return string
	 */
	private function alt_text( array $asset, array $resolved ) {
		$label = ( isset( $asset['label'] ) && '' !== $asset['label'] )
			? $asset['label']
			: __( 'News status icon', 'titlesparks' );

		return (string) apply_filters( 'titlesparks_icon_alt_text', $label, $asset, $resolved );
	}

	/**
	 * Enqueue the front end stylesheet if the site-wide feature is enabled.
	 *
	 * @return void
	 */
	public function enqueue_assets() {
		if ( $this->settings->is_enabled() ) {
			$this->enqueue_stylesheet();
		}
	}

	/**
	 * Enqueue the placement script when eligible posts, widgets or theme
	 * sections could render on this page.
	 *
	 * @return void
	 */
	public function enqueue_script() {
		$file = 'index.js';
		$locations               = $this->settings->display_locations();
		$location                = $this->display_location();
		$widgets_may_render      = ! empty( $locations[ $location ] ) && $this->settings->enabled_home_widget_ids();
		$sections_may_render     = $this->sections_may_render();

		if ( ! $this->icons && ! $widgets_may_render && ! $sections_may_render ) {
			return;
		}

		if ( ! $this->asset_exists( self::BUNDLE, $file ) ) {
			return;
		}

		$manifest = $this->asset_manifest( self::BUNDLE, $file );

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			$this->asset_url( self::BUNDLE, $file ),
			$manifest['dependencies'],
			$this->asset_version( self::BUNDLE, $file ),
			true
		);

		wp_add_inline_script(
			self::SCRIPT_HANDLE,
			'window.' . self::DATA_GLOBAL . ' = ' . wp_json_encode(
				array(
					'icons'    => array_values( $this->icons ),
					// A widget icon is drawn inside a card, which the theme clips;
					// the site says what to do when there is no room for it.
					'tightFit'   => $this->settings->tight_fit(),
					// What the icon's Y offset counts from: the first line of the
					// title, or the middle of all of its lines.
					'iconAnchor' => $this->settings->icon_anchor(),
					// The space the site leaves beside an icon. An entry that carries
					// no answer of its own follows this.
					'iconSpacing' => $this->settings->icon_spacing(),
					// The site's stacking order for the icon, so an icon the author
					// moved over the words is drawn where they expect it.
					'iconZIndex' => $this->settings->icon_z_index(),
					// The site's bands. An entry that carries none of its own is sized
					// from these.
					'sizingRules'       => $this->settings->sizing_rules(),
				),
				// The flags WordPress itself uses for JSON printed inside a
				// <script> element. Slash escaping already keeps `</script>`
				// literal out of this payload; escaping `<`, `>`, `&` and both
				// quote characters makes that independent of that default, so a
				// later `JSON_UNESCAPED_SLASHES` cannot turn a post title into
				// markup. See wp_localize_script().
				JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
			) . ';',
			'before'
		);
	}

	/**
	 * Enqueue the small front end stylesheet.
	 *
	 * @return void
	 */
	private function enqueue_stylesheet() {
		$file = 'assets/css/title-icons.css';
		$path = TITLE_SPARKS_DIR . $file;

		if ( ! is_readable( $path ) ) {
			return;
		}

		// The plugin version is the cache buster: the stylesheet only changes
		// when the plugin does, and hashing it on every request was a file read
		// per page view for an answer that is already known.
		wp_enqueue_style(
			self::SCRIPT_HANDLE,
			TITLE_SPARKS_URL . $file,
			array(),
			TITLE_SPARKS_VERSION
		);
	}
}
