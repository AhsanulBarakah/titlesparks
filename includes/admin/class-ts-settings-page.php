<?php
/**
 * The global settings screen.
 *
 * Deliberately thin: PHP registers its own top-level `add_menu_page()` entry,
 * renders a placeholder that the bundle replaces on its first render, and hands
 * the React bundle a single bootstrap object. All interaction — including
 * uploading and managing the asset library — happens over the REST API, so the
 * same permission and sanitisation rules apply whether the request comes from
 * this screen or anywhere else.
 *
 * @package Title_Sparks
 */

namespace Title_Sparks\Admin;

use Title_Sparks\Asset_Folders;
use Title_Sparks\Asset_Library;
use Title_Sparks\Security;
use Title_Sparks\Settings;
use Title_Sparks\Traits\Assets;
use Title_Sparks\Traits\Security as Security_Trait;

defined( 'ABSPATH' ) || exit;

/**
 * Class Settings_Page
 */
final class Settings_Page {

	use Assets;
	use Security_Trait;

	/**
	 * Bundle directory produced by `npm run build-admin`.
	 */
	const BUNDLE = 'build-admin';

	/**
	 * Handle for the one rule the admin menu icon needs.
	 *
	 * Registered with no source, so WordPress prints its inline CSS in a style
	 * element of its own: the rule names a PHP constant, which is not something
	 * a static stylesheet can hold.
	 */
	const MENU_STYLE_HANDLE = 'titlesparks-admin-menu';

	/**
	 * Handle for the settings screen's placeholder stylesheet.
	 */
	const SKELETON_STYLE_HANDLE = 'titlesparks-admin-skeleton';

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'admin_menu', array( $this, 'add_menu' ) );

		// After `enqueue()`, so the screen's own stylesheet is registered before
		// anything is attached to it, and inside the enqueue hook rather than
		// `admin_head` so WordPress prints the styles it was handed.
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_inline_styles' ), 20 );

		// Priority 1, so this screen's bundle enters the script queue before the
		// files wp-admin and other extensions add on every screen. Footer scripts
		// run in queue order, so being early is what lets the dashboard mount as
		// soon as its own (small) dependency chain is loaded instead of after
		// several megabytes the screen does not need. Nothing here depends on
		// another handler having run first.
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ), 1 );

		add_filter( 'plugin_action_links_' . TITLE_SPARKS_BASENAME, array( $this, 'action_links' ) );
	}

	/**
	 * Add the plugin's own top-level admin page.
	 *
	 * @return void
	 */
	public function add_menu() {
		add_menu_page(
			__( 'TitleSparks', 'titlesparks' ),
			__( 'TitleSparks', 'titlesparks' ),
			'manage_options',
			TITLE_SPARKS_ADMIN_PAGE_SLUG,
			array( $this, 'render' ),
			$this->menu_icon(),
			81
		);
	}

	/**
	 * Return the TitleSparks icon as a base64 data URI for the WordPress menu.
	 *
	 * @return string
	 */
	private function menu_icon() {
		return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjI0NS4yNSA5NS4yNSAxMDkuNSAxMDkuNSIgd2lkdGg9IjIyIiBoZWlnaHQ9IjIyIiBzaGFwZS1yZW5kZXJpbmc9Imdlb21ldHJpY1ByZWNpc2lvbiI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJhIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIi8+PHN0b3Agb2Zmc2V0PSI1MCUiLz48c3RvcCBvZmZzZXQ9IjEwMCUiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgzMDAgMTUwKSI+PGNpcmNsZSByPSI1NCIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjIuNSIvPjxjaXJjbGUgcj0iNDQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLWRhc2hhcnJheT0iNCA4Ii8+PHBhdGggZD0iTTAtNDJxMzggMTYgMzggNTgtMzggMzItNzYgMCAwLTQyIDM4LTU4WiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ1cmwoI2EpIiBzdHJva2Utd2lkdGg9IjMuNSIvPjxjaXJjbGUgY3g9IjI4IiBjeT0iLTI5IiByPSI0Ii8+PGNpcmNsZSByPSI3IiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41Ii8+PHBhdGggZD0iTTE0LTIwYzEgNSAyIDYgNyA3LTUgMS02IDItNyA3LTEtNS0yLTYtNy03IDUtMSA2LTIgNy03TS0xNCA4YzEgNCAyIDUgNiA2LTQgMS01IDItNiA2LTEtNC0yLTUtNi02IDQtMSA1LTIgNi02Ii8+PGNpcmNsZSBjeD0iLTI1IiBjeT0iMjAiIHI9IjIuNSIvPjxjaXJjbGUgY3g9IjI1IiBjeT0iLTgiIHI9IjIuNSIvPjxjaXJjbGUgY3g9Ii0zNSIgY3k9Ii0zNSIgcj0iMy4yIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iLjciLz48Y2lyY2xlIGN4PSIzNSIgY3k9IjM0IiByPSI0IiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iLjciLz48Y2lyY2xlIGN4PSIxMCIgY3k9Ii00OCIgcj0iNC4yIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iLjgiLz48Y2lyY2xlIGN4PSItMjUiIGN5PSI0MyIgcj0iMy40IiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iLjciLz48Y2lyY2xlIGN4PSItNDYiIGN5PSIxMiIgcj0iNC44IiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iLjgiLz48Y2lyY2xlIGN4PSI0NSIgY3k9Ii0yMCIgcj0iMyIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9Ii43Ii8+PC9nPjwvc3ZnPg==';
	}

	/**
	 * Enqueue the two small pieces of styling the React app does not own.
	 *
	 * The menu icon and the mount node's placeholder belong to the page rather
	 * than to the dashboard, so they are not Tailwind's job. Both go through the
	 * enqueue API: the menu rule depends on a PHP constant, so it is attached
	 * with `wp_add_inline_style()` and WordPress prints the style element
	 * itself, and the placeholder is a real stylesheet. This file therefore
	 * prints no asset markup of its own.
	 *
	 * @return void
	 */
	public function enqueue_inline_styles() {
		// The artwork keeps its intrinsic 22px so the same data URI can be
		// reused beside the plugin name; the menu draws it at 20px inside a 34px
		// slot, where WordPress uses the image as a background. The rule names
		// this plugin's own menu item, so no other admin screen is affected.
		wp_register_style( self::MENU_STYLE_HANDLE, false, array(), TITLE_SPARKS_VERSION );
		wp_enqueue_style( self::MENU_STYLE_HANDLE );
		wp_add_inline_style(
			self::MENU_STYLE_HANDLE,
			sprintf(
				'#adminmenu #toplevel_page_%s .wp-menu-image.svg { background-size: 20px auto; }',
				esc_attr( TITLE_SPARKS_ADMIN_PAGE_SLUG )
			)
		);

		if ( ! $this->is_settings_screen() ) {
			return;
		}

		// Versioned by the file's own modification time. The plugin version only
		// moves at a release, and this sheet changes between releases: without
		// this, a browser keeps serving the copy it cached under the old version
		// and a change to this screen looks like it never shipped.
		$skeleton_file    = TITLE_SPARKS_DIR . 'assets/css/admin-skeleton.css';
		$skeleton_version = file_exists( $skeleton_file ) ? (string) filemtime( $skeleton_file ) : TITLE_SPARKS_VERSION;

		wp_enqueue_style(
			self::SKELETON_STYLE_HANDLE,
			TITLE_SPARKS_URL . 'assets/css/admin-skeleton.css',
			array(),
			$skeleton_version
		);
	}

	/**
	 * Whether the current admin screen is this plugin's settings screen.
	 *
	 * `get_current_screen()` exists only once wp-admin has loaded, so a request
	 * that runs these hooks without it — a test bootstrap, a CLI command —
	 * answers no rather than fataling.
	 *
	 * @return bool
	 */
	private function is_settings_screen() {
		if ( ! function_exists( 'get_current_screen' ) ) {
			return false;
		}

		$screen = get_current_screen();

		return $screen && 'toplevel_page_' . TITLE_SPARKS_ADMIN_PAGE_SLUG === $screen->id;
	}

	/**
	 * Add a "Settings" shortcut on the Plugins screen.
	 *
	 * @param string[] $links Existing action links.
	 * @return string[]
	 */
	public function action_links( $links ) {
		if ( ! self::user_can_manage_options() ) {
			return $links;
		}

		$url = admin_url( 'admin.php?page=' . TITLE_SPARKS_ADMIN_PAGE_SLUG );

		array_unshift(
			$links,
			sprintf( '<a href="%s">%s</a>', esc_url( $url ), esc_html__( 'Settings', 'titlesparks' ) )
		);

		return $links;
	}

	/**
	 * Render the mount node.
	 *
	 * @return void
	 */
	public function render() {
		if ( ! self::user_can_manage_options() ) {
			$this->deny( __( 'You are not allowed to manage these settings.', 'titlesparks' ) );
		}

		?>
		<div class="wrap titlesparks-admin-wrap">
			<h1 class="screen-reader-text"><?php echo esc_html( get_admin_page_title() ); ?></h1>
			<?php
			// `titlesparks-app` is the root Tailwind's utilities are scoped to (see
			// tailwind.config.js); without it the app renders its classes but they
			// lose to wp-admin's element rules.
			?>
			<div id="titlesparks-admin-root" class="titlesparks-app">
				<?php
				// A skeleton in the shape of the dashboard: the app replaces it
				// wholesale on its first render (React owns the mount node's
				// children), so the page shows its structure immediately instead of
				// a line of text, and never flashes empty in between.
				?>
				<div class="titlesparks-skeleton" aria-hidden="true">
					<div class="titlesparks-skeleton__bar">
						<span class="titlesparks-skeleton__dot"></span>
						<span class="titlesparks-skeleton__pill titlesparks-skeleton__pill--title"></span>
						<span class="titlesparks-skeleton__pill titlesparks-skeleton__pill--tab"></span>
						<span class="titlesparks-skeleton__pill titlesparks-skeleton__pill--tab"></span>
						<span class="titlesparks-skeleton__pill titlesparks-skeleton__pill--tab"></span>
						<span class="titlesparks-skeleton__pill titlesparks-skeleton__pill--button"></span>
					</div>
					<div class="titlesparks-skeleton__columns">
						<div class="titlesparks-skeleton__column">
							<div class="titlesparks-skeleton__card">
								<span class="titlesparks-skeleton__pill titlesparks-skeleton__pill--heading"></span>
								<span class="titlesparks-skeleton__pill titlesparks-skeleton__pill--text"></span>
								<div class="titlesparks-skeleton__thumbs">
									<?php for ( $thumb = 0; $thumb < 8; $thumb++ ) : ?>
										<span class="titlesparks-skeleton__thumb"></span>
									<?php endfor; ?>
								</div>
							</div>
							<div class="titlesparks-skeleton__card">
								<span class="titlesparks-skeleton__pill titlesparks-skeleton__pill--heading"></span>
								<div class="titlesparks-skeleton__fields">
									<?php for ( $field = 0; $field < 4; $field++ ) : ?>
										<span class="titlesparks-skeleton__field"></span>
									<?php endfor; ?>
								</div>
							</div>
						</div>
						<div class="titlesparks-skeleton__column">
							<?php for ( $card = 0; $card < 3; $card++ ) : ?>
								<div class="titlesparks-skeleton__card">
									<span class="titlesparks-skeleton__pill titlesparks-skeleton__pill--heading"></span>
									<span class="titlesparks-skeleton__pill titlesparks-skeleton__pill--text"></span>
								</div>
							<?php endfor; ?>
						</div>
					</div>
				</div>
				<p class="screen-reader-text"><?php esc_html_e( 'Loading the settings interface…', 'titlesparks' ); ?></p>
			</div>
		</div>
		<?php
	}

	/**
	 * Enqueue the admin bundle on our screen only.
	 *
	 * @param string $hook_suffix Current admin page hook.
	 * @return void
	 */
	public function enqueue( $hook_suffix ) {
		if ( 'toplevel_page_' . TITLE_SPARKS_ADMIN_PAGE_SLUG !== $hook_suffix ) {
			return;
		}

		if ( ! self::user_can_manage_options() ) {
			return;
		}

		$file = 'index.js';

		if ( ! $this->asset_exists( self::BUNDLE, $file ) ) {
			add_action( 'admin_notices', array( $this, 'render_missing_build_notice' ) );

			return;
		}

		$manifest = $this->asset_manifest( self::BUNDLE, $file );
		$version  = $this->asset_version( self::BUNDLE, $file );

		// The native WordPress media modal is not enqueued here. It is a
		// megabyte of scripts plus its footer templates, and it is only needed
		// once someone clicks "Add New Asset" — so it is fetched on that click
		// (see `Admin\Media_Modal` and `useMediaFrame`). Loading it with the page
		// also put its scripts ahead of this bundle in the footer queue, which
		// delayed the dashboard's first paint by the time it took to download.
		wp_enqueue_script(
			TITLE_SPARKS_ADMIN_HANDLE,
			$this->asset_url( self::BUNDLE, $file ),
			$manifest['dependencies'],
			$version,
			true
		);

		if ( $this->asset_exists( self::BUNDLE, 'index.css' ) ) {
			wp_enqueue_style(
				TITLE_SPARKS_ADMIN_HANDLE,
				$this->asset_url( self::BUNDLE, 'index.css' ),
				array( 'wp-components' ),
				$version
			);
			wp_style_add_data( TITLE_SPARKS_ADMIN_HANDLE, 'rtl', 'replace' );
		}

		$this->localize();

		// Translations are resolved in PHP so the React bundle needs no string
		// registration step of its own.
		wp_set_script_translations( TITLE_SPARKS_ADMIN_HANDLE, TITLE_SPARKS_TEXTDOMAIN, TITLE_SPARKS_DIR . 'languages' );
	}

	/**
	 * Bootstrap data for the admin app.
	 *
	 * @return void
	 */
	private function localize() {
		$settings = Settings::instance();

		$data = array(
			'namespace'  => TITLE_SPARKS_REST_NAMESPACE,
			'restUrl'    => esc_url_raw( rest_url( TITLE_SPARKS_REST_NAMESPACE ) ),
			'nonce'      => wp_create_nonce( 'wp_rest' ),
			'settings'   => $settings->all(),
			'assets'     => ( new Asset_Library( $settings ) )->to_editor_list(),
			// Folders also ride inside `settings`; named here as well so the two
			// halves of the same library read the same way in the bootstrap.
			'folders'    => ( new Asset_Folders( $settings ) )->all(),
			'postTypes'  => $this->available_post_types(),
			'widgets'    => $settings->active_widgets(),
			'sections'   => $settings->homepage_sections(),
			// The theme the scan read. The settings screen names it beside the
			// areas, because that list is cached from whichever theme was active
			// when it was built.
			'theme'      => $this->active_theme(),
			'positions'  => Security::allowed_positions(),
			'behaviours' => Security::allowed_behaviours(),
			'units'      => Security::allowed_units(),
			'defaults'   => $settings->defaults(),
			'version'    => TITLE_SPARKS_VERSION,
			// This page, so the app can link between its own tabs — the post
			// editor deep links here from the sidebar.
			'settingsUrl' => admin_url( 'admin.php?page=' . TITLE_SPARKS_ADMIN_PAGE_SLUG ),
			// The moment the default stages are counted from. A fixed timeline
			// start is that moment; otherwise the site's clock stands in, because
			// a post that does not exist yet has no publish date. Only the lengths
			// are stored, so this is a reference for the date fields to read.
			'anchor'             => $this->anchor_reference( $settings ),
			// The settings navbar's multicolor artwork.
			'dashboardLogoUrl' => TITLE_SPARKS_URL . 'assets/logos/dashboard-navbar.svg',
		);

		wp_add_inline_script(
			TITLE_SPARKS_ADMIN_HANDLE,
			'window.titleSparksAdminData = ' . wp_json_encode(
				$data,
				// WordPress' own flags for JSON inside a <script> element; see
				// the same note in Title_Renderer::enqueue_script().
				JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
			) . ';',
			'before'
		);
	}

	/**
	 * The moment the default stages are counted from.
	 *
	 * @param Settings $settings Settings instance.
	 * @return string `Y-m-d H:i:s` on the site clock.
	 */
	private function anchor_reference( $settings ) {
		if ( 'fixed' === $settings->get( 'anchor_source', 'post' ) ) {
			$fixed = Security::anchor( $settings->get( 'anchor_datetime', '' ) );

			if ( '' !== $fixed ) {
				return $fixed;
			}
		}

		return (string) current_time( 'Y-m-d H:i:s' );
	}

	/**
	 * The active theme, as the settings screen names it.
	 *
	 * A child theme is what is active while its parent's templates are what the
	 * site renders, so both names are sent: a section the child's own files do
	 * not contain is still a section this site prints. The name alone is also
	 * not an identifier — two themes can share one — which is why the stylesheet
	 * directory rides along, and why it stands in when a theme declares no name.
	 *
	 * @return array{name: string, parent: string, stylesheet: string}
	 */
	private function active_theme() {
		$theme  = wp_get_theme();
		$parent = $theme->parent();
		$name   = (string) $theme->get( 'Name' );

		return array(
			'name'       => '' !== $name ? $name : (string) $theme->get_stylesheet(),
			'parent'     => $parent ? (string) $parent->get( 'Name' ) : '',
			'stylesheet' => (string) $theme->get_stylesheet(),
		);
	}

	/**
	 * Public post types offered in the "enable for" list.
	 *
	 * @return array[]
	 */
	private function available_post_types() {
		$types = get_post_types( array( 'public' => true ), 'objects' );
		$list  = array();

		foreach ( $types as $type ) {
			if ( 'attachment' === $type->name ) {
				continue;
			}

			$list[] = array(
				'value' => $type->name,
				'label' => $type->labels->singular_name,
			);
		}

		return $list;
	}

	/**
	 * Notice shown when the compiled bundle is missing.
	 *
	 * @return void
	 */
	public function render_missing_build_notice() {
		?>
		<div class="notice notice-error">
			<p>
				<?php
				printf(
					/* translators: %s: the npm command, wrapped in a <code> element. */
					esc_html__( 'TitleSparks: the admin bundle is missing. Run %s in the plugin directory.', 'titlesparks' ),
					// The sentence is escaped above; the one element it allows is
					// escaped here, so the markup is the only thing that survives rather
					// than being trusted because it happens to be a literal today.
					wp_kses(
						'<code>npm install &amp;&amp; npm run build-admin</code>',
						array( 'code' => array() )
					)
				);
				?>
			</p>
		</div>
		<?php
	}
}
