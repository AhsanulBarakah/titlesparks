<?php
/**
 * REST API surface.
 *
 * The admin app and the block editor sidebar talk to the plugin exclusively
 * through these routes. That is a deliberate security decision: every request
 * passes through a `permission_callback` here, so there is exactly one place to
 * audit for capability and nonce handling on the write path.
 *
 * @package Title_Sparks
 */

namespace Title_Sparks;

use Title_Sparks\Admin\Media_Modal;
use Title_Sparks\Security;
use Title_Sparks\Traits\Security as Security_Trait;

defined( 'ABSPATH' ) || exit;

/**
 * Class Rest_Controller
 */
final class Rest_Controller {

	use Security_Trait;

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Declare the routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			TITLE_SPARKS_REST_NAMESPACE,
			'/settings',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_settings' ),
					'permission_callback' => array( $this, 'can_read_settings' ),
				),
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'update_settings' ),
					'permission_callback' => array( $this, 'can_write_settings' ),
					'args'                => array(
						'settings' => array(
							'type'        => 'object',
							'required'    => true,
							'description' => __( 'Full settings payload.', 'titlesparks' ),
						),
					),
				),
			)
		);

		register_rest_route(
			TITLE_SPARKS_REST_NAMESPACE,
			'/homepage-sections',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_homepage_sections' ),
				'permission_callback' => array( $this, 'can_read_settings' ),
			)
		);

		register_rest_route(
			TITLE_SPARKS_REST_NAMESPACE,
			'/assets',
			array(
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'create_asset' ),
				'permission_callback' => array( $this, 'can_write_settings' ),
				'args'                => array(
					'asset' => array(
						'type'     => 'object',
						'required' => true,
					),
				),
			)
		);

		register_rest_route(
			TITLE_SPARKS_REST_NAMESPACE,
			'/assets/(?P<id>[a-zA-Z0-9_-]{1,64})',
			array(
				'methods'             => \WP_REST_Server::DELETABLE,
				'callback'            => array( $this, 'delete_asset' ),
				'permission_callback' => array( $this, 'can_write_settings' ),
				'args'                => array(
					'id' => array(
						'type'              => 'string',
						'required'          => true,
						'sanitize_callback' => array( __CLASS__, 'sanitize_id_param' ),
					),
				),
			)
		);

		register_rest_route(
			TITLE_SPARKS_REST_NAMESPACE,
			'/folders',
			array(
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'save_folder' ),
				'permission_callback' => array( $this, 'can_write_settings' ),
				'args'                => array(
					'folder' => array(
						'type'        => 'object',
						'required'    => true,
						'description' => __( 'One folder: a name and the tags it collects.', 'titlesparks' ),
					),
				),
			)
		);

		register_rest_route(
			TITLE_SPARKS_REST_NAMESPACE,
			'/folders/(?P<id>[a-zA-Z0-9_-]{1,64})',
			array(
				'methods'             => \WP_REST_Server::DELETABLE,
				'callback'            => array( $this, 'delete_folder' ),
				'permission_callback' => array( $this, 'can_write_settings' ),
				'args'                => array(
					'id' => array(
						'type'              => 'string',
						'required'          => true,
						'sanitize_callback' => array( __CLASS__, 'sanitize_id_param' ),
					),
				),
			)
		);

		register_rest_route(
			TITLE_SPARKS_REST_NAMESPACE,
			'/media-modal',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_media_modal' ),
				'permission_callback' => array( $this, 'can_write_settings' ),
			)
		);

		register_rest_route(
			TITLE_SPARKS_REST_NAMESPACE,
			'/preview/(?P<post_id>\d+)',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( $this, 'preview' ),
				'permission_callback' => array( $this, 'can_preview' ),
				'args'                => array(
					'post_id'  => array(
						'type'     => 'integer',
						'required' => true,
					),
					'timeline' => array(
						'type'        => 'object',
						'required'    => false,
						'description' => __( 'Unsaved timeline to preview.', 'titlesparks' ),
					),
				),
			)
		);
	}

	/**
	 * Sanitize callback for an `{id}` route parameter.
	 *
	 * Shared by the asset and folder routes: both identifiers are slugs from the
	 * same alphabet, validated again on the way into the store.
	 *
	 * @param mixed $value Raw parameter.
	 * @return string
	 */
	public static function sanitize_id_param( $value ) {
		return Security::asset_id( $value );
	}

	/* ---------------------------------------------------------------------
	 * Permission callbacks.
	 * ------------------------------------------------------------------ */

	/**
	 * Reading settings requires the same capability as writing them.
	 *
	 * @return bool|\WP_Error
	 */
	public function can_read_settings() {
		return $this->can_manage_settings();
	}

	/**
	 * Writing settings requires `manage_options`.
	 *
	 * @return bool|\WP_Error
	 */
	public function can_write_settings() {
		return $this->can_manage_settings();
	}

	/**
	 * Previewing requires the ability to edit that specific post.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return bool|\WP_Error
	 */
	public function can_preview( $request ) {
		$post_id = (int) $request->get_param( 'post_id' );

		if ( ! self::user_can_edit_post( $post_id ) ) {
			return new \WP_Error(
				'titlesparks_forbidden',
				__( 'You are not allowed to edit this post.', 'titlesparks' ),
				array( 'status' => rest_authorization_required_code() )
			);
		}

		return true;
	}

	/**
	 * Shared `manage_options` gate returning a REST-friendly error.
	 *
	 * @return bool|\WP_Error
	 */
	private function can_manage_settings() {
		if ( ! self::user_can_manage_options() ) {
			return new \WP_Error(
				'titlesparks_forbidden',
				__( 'You are not allowed to manage TitleSparks settings.', 'titlesparks' ),
				array( 'status' => rest_authorization_required_code() )
			);
		}

		return true;
	}

	/* ---------------------------------------------------------------------
	 * Handlers.
	 * ------------------------------------------------------------------ */

	/**
	 * GET /settings
	 *
	 * @return \WP_REST_Response
	 */
	public function get_settings() {
		$settings = Settings::instance();
		$library  = new Asset_Library( $settings );

		// Opening this screen is the one place a missing still frame is made for
		// the assets that need one. A visitor's page view must never write a
		// file or the settings row, so this screen is where a library catches up.
		// A few per load keeps a large library from timing out; the rest follow
		// on later visits.
		$library->build_missing_stills( 5 );

		return rest_ensure_response(
			array(
				'settings'   => $settings->all(),
				'assets'     => $library->to_editor_list(),
				'folders'    => ( new Asset_Folders( $settings ) )->all(),
				'positions'  => Security::allowed_positions(),
				'behaviours' => Security::allowed_behaviours(),
				'units'      => Security::allowed_units(),
				'defaults'   => $settings->defaults(),
			)
		);
	}

	/**
	 * GET /homepage-sections
	 *
	 * Runs the deep scan again, so the settings screen can pick up a template,
	 * a post, a page or a widget that was added while the screen was open. This
	 * is a REST request, which is one of the requests allowed to rebuild the
	 * cached scan, so the rebuild happens here rather than being queued.
	 *
	 * @return \WP_REST_Response
	 */
	public function get_homepage_sections() {
		$settings = Settings::instance();

		$settings->rebuild_scan();

		return rest_ensure_response(
			array(
				'sections' => $settings->homepage_sections(),
				'widgets'  => $settings->active_widgets(),
				'theme'    => wp_get_theme()->get( 'Name' ),
				'message'  => __( 'Homepage sections rescanned.', 'titlesparks' ),
			)
		);
	}

	/**
	 * POST /settings
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response
	 */
	public function update_settings( $request ) {
		$payload = self::deep_unslash( $request->get_param( 'settings' ) );
		$payload = is_array( $payload ) ? $payload : array();

		// Merge onto the stored row so a payload that omits a key (for
		// example the asset library) cannot silently blank it out.
		$stored = Settings::instance()->update( array_merge( Settings::instance()->all(), $payload ) );

		return rest_ensure_response(
			array(
				'settings' => $stored,
				'assets'   => ( new Asset_Library() )->to_editor_list(),
				'folders'  => ( new Asset_Folders() )->all(),
				'message'  => __( 'Settings saved.', 'titlesparks' ),
			)
		);
	}

	/**
	 * POST /folders
	 *
	 * Creates a folder, or updates the one whose identifier it carries.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function save_folder( $request ) {
		$folders = new Asset_Folders();
		$payload = self::deep_unslash( $request->get_param( 'folder' ) );
		$payload = is_array( $payload ) ? $payload : array();

		$folder = $folders->save( $payload );

		if ( null === $folder ) {
			return new \WP_Error(
				'titlesparks_invalid_folder',
				__( 'A folder needs a name.', 'titlesparks' ),
				array( 'status' => 400 )
			);
		}

		return rest_ensure_response(
			array(
				'folder'  => $folder,
				'folders' => $folders->all(),
				'message' => __( 'Folder saved.', 'titlesparks' ),
			)
		);
	}

	/**
	 * DELETE /folders/{id}
	 *
	 * Removes the folder only; its assets and their tags are left alone.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function delete_folder( $request ) {
		$folders = new Asset_Folders();
		$id      = Security::asset_id( $request->get_param( 'id' ) );

		if ( ! $folders->delete( $id ) ) {
			return new \WP_Error(
				'titlesparks_folder_not_found',
				__( 'That folder does not exist.', 'titlesparks' ),
				array( 'status' => 404 )
			);
		}

		return rest_ensure_response(
			array(
				'folders' => $folders->all(),
				'message' => __( 'Folder removed.', 'titlesparks' ),
			)
		);
	}

	/**
	 * POST /assets
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function create_asset( $request ) {
		$library = new Asset_Library();
		$payload = self::deep_unslash( $request->get_param( 'asset' ) );
		$payload = is_array( $payload ) ? $payload : array();

		// A selected attachment must be editable by this user, and its URL is
		// always resolved by the server rather than trusted from the request.
		if ( ! empty( $payload['attachment_id'] ) ) {
			$attachment_id = Security::attachment_id( $payload['attachment_id'] );

			if ( ! $attachment_id || ! Security::can_edit_attachment( $attachment_id ) ) {
				return new \WP_Error(
					'titlesparks_forbidden_attachment',
					__( 'You are not allowed to use that media attachment.', 'titlesparks' ),
					array( 'status' => rest_authorization_required_code() )
				);
			}

			$from_attachment = $library->from_attachment(
				$attachment_id,
				isset( $payload['label'] ) ? $payload['label'] : ''
			);

			if ( null === $from_attachment ) {
				return new \WP_Error(
					'titlesparks_invalid_asset',
					__( 'That media attachment cannot be used as an image.', 'titlesparks' ),
					array( 'status' => 400 )
				);
			}

			$payload = $from_attachment;
		}

		$asset = $library->save( $payload );

		if ( null === $asset ) {
			return new \WP_Error(
				'titlesparks_invalid_asset',
				__( 'An asset needs both an image URL and a name.', 'titlesparks' ),
				array( 'status' => 400 )
			);
		}

		return rest_ensure_response(
			array(
				'asset'   => $asset,
				'assets'  => $library->to_editor_list(),
				'folders' => ( new Asset_Folders() )->all(),
				'message' => __( 'Asset saved.', 'titlesparks' ),
			)
		);
	}

	/**
	 * DELETE /assets/{id}
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function delete_asset( $request ) {
		$library = new Asset_Library();
		$id      = Security::asset_id( $request->get_param( 'id' ) );

		if ( ! $library->delete( $id ) ) {
			return new \WP_Error(
				'titlesparks_asset_not_found',
				__( 'That asset does not exist.', 'titlesparks' ),
				array( 'status' => 404 )
			);
		}

		return rest_ensure_response(
			array(
				'assets'  => $library->to_editor_list(),
				'message' => __( 'Asset removed.', 'titlesparks' ),
			)
		);
	}

	/**
	 * GET /media-modal
	 *
	 * The WordPress media modal's markup, for the dashboard to inject the first
	 * time an administrator opens the uploader. Serving it per request instead
	 * of enqueueing it on every visit is what keeps the settings screen light;
	 * `Admin\Media_Modal` explains the trade in full.
	 *
	 * @return \WP_REST_Response
	 */
	public function get_media_modal() {
		return rest_ensure_response(
			array( 'html' => Media_Modal::markup() )
		);
	}

	/**
	 * GET /preview/{post_id}
	 *
	 * Returns the icon markup and the computed stage for the editor's live
	 * preview. Passing `timeline` previews unsaved changes.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response
	 */
	public function preview( $request ) {
		$post_id  = (int) $request->get_param( 'post_id' );
		$meta     = new Post_Meta();
		$timeline = $request->get_param( 'timeline' );

		if ( is_array( $timeline ) ) {
			$timeline = Security::timeline( self::deep_unslash( $timeline ) );
		} else {
			$timeline = $meta->get( $post_id );
		}

		$resolved = Decay::resolve( $timeline, $post_id, 0, Settings::instance()->anchor_for( $timeline ) );
		$renderer = new Title_Renderer( $meta );

		return rest_ensure_response(
			array(
				'stage'     => (int) $resolved['stage'],
				'expired'   => (bool) $resolved['expired'],
				'remaining' => (int) $resolved['remaining'],
				'endsAt'    => gmdate( 'c', (int) $resolved['ends_at'] ),
				'html'      => $renderer->render_for_timeline( $timeline, $post_id ),
				'summary'   => Decay::describe( $resolved ),
			)
		);
	}
}
