<?php
/**
 * Hostile-request tests for the REST surface and the classic save path.
 *
 * Every route the plugin registers is called the way an attacker would call it:
 * signed out, signed in with too few capabilities, and signed in as an
 * administrator with a missing or forged CSRF nonce. The tests then assert two
 * things each time — that the request is refused, and that the refusal left no
 * trace in the database.
 *
 * Run after loading WordPress, for example:
 * php -r 'require "path/to/wp-load.php"; require "tests/php/test-rest-hostile-requests.php"; titlesparks_test_rest_hostile_requests();'
 *
 * The tests write to the database (they have to: the interesting failures are
 * the ones that write when they should not), so every fixture is removed and
 * the settings option is restored in a `finally` block. The temporary users,
 * posts and options are named so a crashed run is obvious.
 *
 * @package Title_Sparks
 */

defined( 'ABSPATH' ) || exit;

use Title_Sparks\Asset_Library;
use Title_Sparks\Post_Meta;
use Title_Sparks\Security;
use Title_Sparks\Settings;

/**
 * Run the hostile-request tests against a bootstrapped WordPress install.
 *
 * @throws RuntimeException When an assertion fails or a fixture cannot be created.
 * @return void
 */
function titlesparks_test_rest_hostile_requests() {
	global $wp_rest_auth_cookie;

	$settings   = Settings::instance();
	$assertions = 0;
	$failures   = array();
	$skipped    = array();
	$created    = array(
		'users' => array(),
		'posts' => array(),
	);

	// Collected rather than thrown, so one failed guard does not hide the rest.
	$assert = static function ( $condition, $label ) use ( &$assertions, &$failures ) {
		++$assertions;

		if ( ! $condition ) {
			$failures[] = $label;
		}
	};

	$previous_option  = get_option( Settings::OPTION, false );
	$had_option       = false !== $previous_option;
	$previous_user    = get_current_user_id();
	$previous_post    = $_POST; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Snapshot of the CLI process, not a request.
	$previous_request = $_REQUEST; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Snapshot of the CLI process, not a request.
	$previous_auth    = isset( $wp_rest_auth_cookie ) ? $wp_rest_auth_cookie : null;

	/**
	 * Create a user for a role, or reuse the one a previous run left behind.
	 *
	 * @param string $role  Role slug.
	 * @param string $login Login name.
	 * @return int User ID, or 0 on failure.
	 */
	$make_user = static function ( $role, $login ) use ( &$created ) {
		$existing = get_user_by( 'login', $login );

		if ( $existing instanceof WP_User ) {
			return (int) $existing->ID;
		}

		$user_id = wp_insert_user(
			array(
				'user_login' => $login,
				'user_pass'  => wp_generate_password( 32 ),
				'user_email' => $login . '@example.invalid',
				'role'       => $role,
			)
		);

		if ( is_wp_error( $user_id ) ) {
			return 0;
		}

		$created['users'][] = (int) $user_id;

		return (int) $user_id;
	};

	/**
	 * Create a post fixture.
	 *
	 * @param int    $author_id Post author.
	 * @param string $status    Post status.
	 * @param string $title     Post title.
	 * @return int Post ID, or 0 on failure.
	 */
	$make_post = static function ( $author_id, $status, $title ) use ( &$created ) {
		$post_id = wp_insert_post(
			array(
				'post_title'   => $title,
				'post_status'  => $status,
				'post_type'    => 'post',
				'post_author'  => $author_id,
				'post_content' => 'TitleSparks hostile request fixture.',
			),
			true
		);

		if ( is_wp_error( $post_id ) ) {
			return 0;
		}

		$created['posts'][] = (int) $post_id;

		return (int) $post_id;
	};

	/**
	 * Build a valid `wp_rest` nonce for a user.
	 *
	 * @param int $user_id User ID.
	 * @return string
	 */
	$nonce_for = static function ( $user_id ) {
		wp_set_current_user( (int) $user_id );

		return wp_create_nonce( 'wp_rest' );
	};

	/**
	 * Send a request the way a browser does: cookie authentication first, then
	 * the route's own permission callback.
	 *
	 * `rest_do_request()` on its own skips `check_authentication()`, so calling
	 * it alone would test the permission callbacks while silently ignoring the
	 * CSRF nonce. That is the half an attacker exploits, so the authentication
	 * step is reproduced here in the same order `serve_request()` uses.
	 *
	 * @param string      $method  HTTP method.
	 * @param string      $route   Route to call.
	 * @param array       $params  Request parameters.
	 * @param int         $user_id User to act as; 0 for anonymous.
	 * @param string|null $nonce   `wp_rest` nonce, or null for none.
	 * @return array{status: int, code: string, data: mixed}
	 */
	$dispatch = static function ( $method, $route, $params = array(), $user_id = 0, $nonce = null ) use ( &$wp_rest_auth_cookie ) {
		wp_set_current_user( (int) $user_id );

		// Model a browser request: the auth cookie is what identified the user.
		$wp_rest_auth_cookie = $user_id > 0;

		if ( null === $nonce ) {
			unset( $_SERVER['HTTP_X_WP_NONCE'], $_REQUEST['_wpnonce'] );
		} else {
			$_SERVER['HTTP_X_WP_NONCE'] = $nonce;
			$_REQUEST['_wpnonce']       = $nonce;
		}

		$authentication = rest_get_server()->check_authentication();

		if ( is_wp_error( $authentication ) ) {
			$error  = $authentication->get_error_data();
			$status = is_array( $error ) && isset( $error['status'] ) ? (int) $error['status'] : 500;

			return array(
				'status' => $status,
				'code'   => (string) $authentication->get_error_code(),
				'data'   => null,
			);
		}

		$request = new WP_REST_Request( $method, $route );

		foreach ( $params as $key => $value ) {
			$request->set_param( $key, $value );
		}

		$response = rest_do_request( $request );

		if ( is_wp_error( $response ) ) {
			$error  = $response->get_error_data();
			$status = is_array( $error ) && isset( $error['status'] ) ? (int) $error['status'] : 500;

			return array(
				'status' => $status,
				'code'   => (string) $response->get_error_code(),
				'data'   => null,
			);
		}

		$body = $response->get_data();

		// A refusal reaches here already converted to a response, with the
		// WP_Error code kept in the body.
		return array(
			'status' => (int) $response->get_status(),
			'code'   => is_array( $body ) && isset( $body['code'] ) ? (string) $body['code'] : '',
			'data'   => $body,
		);
	};

	try {
		$routes = rest_get_server()->get_routes();

		// A suite where every request 404s would look secure and prove nothing.
		$assert(
			isset( $routes['/titlesparks/v1/settings'] ),
			'The /titlesparks/v1/settings route must be registered, or these tests prove nothing.'
		);
		$assert(
			isset( $routes['/titlesparks/v1/preview/(?P<post_id>\d+)'] ),
			'The preview route must be registered, or these tests prove nothing.'
		);

		$admins   = get_users(
			array(
				'role'   => 'administrator',
				'number' => 1,
				'fields' => 'ID',
			)
		);
		$admin_id = $admins ? (int) $admins[0] : $make_user( 'administrator', 'titlesparks_audit_admin' );

		$subscriber_id = $make_user( 'subscriber', 'titlesparks_audit_subscriber' );
		$author_id     = $make_user( 'author', 'titlesparks_audit_author' );

		if ( $admin_id < 1 || $subscriber_id < 1 || $author_id < 1 ) {
			throw new RuntimeException( 'Could not create the users these tests need.' );
		}

		$published_id = $make_post( $admin_id, 'publish', 'TitleSparks hostile request published post' );
		$admin_draft  = $make_post( $admin_id, 'draft', 'TitleSparks hostile request admin draft' );
		$author_draft = $make_post( $author_id, 'draft', 'TitleSparks hostile request author draft' );

		if ( $published_id < 1 || $admin_draft < 1 || $author_draft < 1 ) {
			throw new RuntimeException( 'Could not create the posts these tests need.' );
		}

		$admin_nonce      = $nonce_for( $admin_id );
		$subscriber_nonce = $nonce_for( $subscriber_id );
		$author_nonce     = $nonce_for( $author_id );

		/*
		-----------------------------------------------------------------
		 * 1. Signed out.
		 * --------------------------------------------------------------
		 */

		$response = $dispatch( 'GET', '/titlesparks/v1/settings' );

		$assert( 401 === $response['status'], 'GET /settings must answer an anonymous caller with 401, not ' . $response['status'] . '.' );
		$assert(
			'titlesparks_forbidden' === $response['code'],
			'GET /settings must be refused by the permission callback, not by routing (got ' . ( '' !== $response['code'] ? $response['code'] : 'no error code' ) . ').'
		);

		$before   = get_option( Settings::OPTION, null );
		$response = $dispatch( 'POST', '/titlesparks/v1/settings', array( 'settings' => array( 'enabled' => true ) ) );

		$assert( 401 === $response['status'], 'POST /settings must answer an anonymous caller with 401, not ' . $response['status'] . '.' );
		$assert( get_option( Settings::OPTION, null ) === $before, 'An anonymous POST /settings must not touch the settings option.' );

		$anonymous_routes = array(
			'GET /homepage-sections' => array( 'GET', '/titlesparks/v1/homepage-sections' ),
			'POST /assets'           => array(
				'POST',
				'/titlesparks/v1/assets',
				array(
					'asset' => array(
						'id'    => 'anon-asset',
						'url'   => 'https://example.invalid/anon.gif',
						'label' => 'Anonymous asset',
					),
				),
			),
			'POST /folders'          => array(
				'POST',
				'/titlesparks/v1/folders',
				array( 'folder' => array( 'name' => 'Anonymous folder' ) ),
			),
			'GET /media-modal'       => array( 'GET', '/titlesparks/v1/media-modal' ),
			'DELETE /assets/{id}'    => array( 'DELETE', '/titlesparks/v1/assets/some-asset' ),
			'DELETE /folders/{id}'   => array( 'DELETE', '/titlesparks/v1/folders/some-folder' ),
			'GET /preview/{post_id}' => array( 'GET', '/titlesparks/v1/preview/' . $published_id ),
		);

		foreach ( $anonymous_routes as $label => $call ) {
			$params   = isset( $call[2] ) ? $call[2] : array();
			$response = $dispatch( $call[0], $call[1], $params );

			$assert(
				401 === $response['status'],
				$label . ' must answer an anonymous caller with 401, not ' . $response['status'] . '.'
			);
		}

		/*
		-----------------------------------------------------------------
		 * 2. A subscriber: signed in, no capability, valid nonce.
		 * --------------------------------------------------------------
		 */

		$response = $dispatch( 'GET', '/titlesparks/v1/settings', array(), $subscriber_id, $subscriber_nonce );

		$assert( 403 === $response['status'], 'GET /settings must answer a subscriber with 403, not ' . $response['status'] . '.' );

		$before   = get_option( Settings::OPTION, null );
		$response = $dispatch(
			'POST',
			'/titlesparks/v1/settings',
			array(
				'settings' => array(
					'enabled'    => true,
					'post_types' => array( 'post', 'page' ),
				),
			),
			$subscriber_id,
			$subscriber_nonce
		);

		$assert( 403 === $response['status'], 'POST /settings must answer a subscriber with 403, not ' . $response['status'] . '.' );
		$assert( get_option( Settings::OPTION, null ) === $before, 'A subscriber POST /settings must not touch the settings option.' );

		$response = $dispatch( 'GET', '/titlesparks/v1/preview/' . $published_id, array(), $subscriber_id, $subscriber_nonce );

		$assert( 403 === $response['status'], 'A subscriber must not preview a post they cannot edit (got ' . $response['status'] . ').' );

		/*
		-----------------------------------------------------------------
		 * 3. An author: can edit their own post, nothing else.
		 * --------------------------------------------------------------
		 */

		$response = $dispatch( 'GET', '/titlesparks/v1/settings', array(), $author_id, $author_nonce );
		$assert( 403 === $response['status'], 'GET /settings must answer an author with 403, not ' . $response['status'] . '.' );

		$response = $dispatch( 'GET', '/titlesparks/v1/media-modal', array(), $author_id, $author_nonce );
		$assert( 403 === $response['status'], 'GET /media-modal must answer an author with 403, not ' . $response['status'] . '.' );

		$response = $dispatch( 'GET', '/titlesparks/v1/homepage-sections', array(), $author_id, $author_nonce );
		$assert( 403 === $response['status'], 'GET /homepage-sections must answer an author with 403, not ' . $response['status'] . '.' );

		$before   = get_option( Settings::OPTION, null );
		$response = $dispatch(
			'POST',
			'/titlesparks/v1/folders',
			array( 'folder' => array( 'name' => 'Author folder' ) ),
			$author_id,
			$author_nonce
		);

		$assert( 403 === $response['status'], 'POST /folders must answer an author with 403, not ' . $response['status'] . '.' );
		$assert( get_option( Settings::OPTION, null ) === $before, 'An author POST /folders must not touch the settings option.' );

		$response = $dispatch( 'GET', '/titlesparks/v1/preview/' . $author_draft, array(), $author_id, $author_nonce );
		$assert( 200 === $response['status'], 'An author must be able to preview their own draft (got ' . $response['status'] . ').' );

		$response = $dispatch( 'GET', '/titlesparks/v1/preview/' . $admin_draft, array(), $author_id, $author_nonce );
		$assert( 403 === $response['status'], 'An author must not preview another user\'s draft (got ' . $response['status'] . ').' );

		// The auth_callback behind the registered post meta, tested directly.
		$meta_object = new Post_Meta();

		wp_set_current_user( $author_id );
		$assert(
			false === $meta_object->can_edit_meta( true, Post_Meta::META_KEY, $admin_draft ),
			'can_edit_meta() must refuse an author on another user\'s draft.'
		);
		$assert(
			true === $meta_object->can_edit_meta( true, Post_Meta::META_KEY, $author_draft ),
			'can_edit_meta() must allow an author on their own draft.'
		);

		/*
		-----------------------------------------------------------------
		 * 4. CSRF: an administrator's cookie without a matching nonce.
		 * --------------------------------------------------------------
		 */

		$before   = get_option( Settings::OPTION, null );
		$response = $dispatch( 'POST', '/titlesparks/v1/settings', array( 'settings' => array( 'enabled' => true ) ), $admin_id, null );

		$assert(
			401 === $response['status'],
			'A cookie-authenticated write with no nonce must be treated as signed out (401), not ' . $response['status'] . '.'
		);
		$assert( get_option( Settings::OPTION, null ) === $before, 'A cookie-authenticated write with no nonce must not touch the option.' );

		$response = $dispatch( 'POST', '/titlesparks/v1/settings', array( 'settings' => array( 'enabled' => true ) ), $admin_id, 'not-a-real-nonce' );

		$assert( 403 === $response['status'], 'A forged nonce must be refused with 403, not ' . $response['status'] . '.' );
		$assert(
			'rest_cookie_invalid_nonce' === $response['code'],
			'A forged nonce must fail the cookie check (got ' . $response['code'] . ').'
		);
		$assert( get_option( Settings::OPTION, null ) === $before, 'A forged nonce must not touch the option.' );

		// A nonce minted for another action is not a wp_rest nonce.
		$wrong_action_nonce = wp_create_nonce( 'titlesparks_save_timeline' );
		$response           = $dispatch( 'POST', '/titlesparks/v1/settings', array( 'settings' => array( 'enabled' => true ) ), $admin_id, $wrong_action_nonce );

		$assert( 403 === $response['status'], 'A nonce minted for another action must be refused with 403, not ' . $response['status'] . '.' );
		$assert( get_option( Settings::OPTION, null ) === $before, 'A nonce minted for another action must not touch the option.' );

		/*
		-----------------------------------------------------------------
		 * 5. The administrator path still works.
		 * --------------------------------------------------------------
		 */

		$response = $dispatch( 'GET', '/titlesparks/v1/settings', array(), $admin_id, $admin_nonce );
		$assert( 200 === $response['status'], 'An administrator with a valid nonce must be able to read the settings (got ' . $response['status'] . ').' );

		$response = $dispatch(
			'POST',
			'/titlesparks/v1/settings',
			array( 'settings' => array( 'enabled' => true ) ),
			$admin_id,
			$admin_nonce
		);
		$assert( 200 === $response['status'], 'An administrator with a valid nonce must be able to save the settings (got ' . $response['status'] . ').' );

		$settings->flush_cache();
		$stored = get_option( Settings::OPTION, array() );
		$assert( true === ( isset( $stored['enabled'] ) && $stored['enabled'] ), 'The administrator save of `enabled` must be persisted.' );

		/*
		-----------------------------------------------------------------
		 * 6. Hostile payloads from an authorised caller.
		 *
		 * Capability checks are only half the story: a compromised or careless
		 * administrator account must still not be able to store script.
		 * --------------------------------------------------------------
		 */

		$response = $dispatch(
			'POST',
			'/titlesparks/v1/assets',
			array(
				'asset' => array(
					'id'    => 'audit-icon',
					'url'   => 'https://example.invalid/audit-icon.gif',
					'label' => 'Audit icon',
					'size'  => '24px',
				),
			),
			$admin_id,
			$admin_nonce
		);

		$assert( 200 === $response['status'], 'An administrator must be able to add a library asset (got ' . $response['status'] . ').' );

		$library = new Asset_Library();
		$count   = count( $library->to_editor_list() );
		$assert( 1 <= $count, 'The library must contain the asset that was just added.' );

		$response = $dispatch(
			'POST',
			'/titlesparks/v1/assets',
			array(
				'asset' => array(
					'id'    => 'script-asset',
					'url'   => 'javascript:alert(1)',
					'label' => 'Script asset',
				),
			),
			$admin_id,
			$admin_nonce
		);

		$assert( 400 === $response['status'], 'A javascript: URL must be rejected with 400, not ' . $response['status'] . '.' );
		$assert(
			count( $library->to_editor_list() ) === $count,
			'A rejected javascript: asset must not be added to the library.'
		);

		$response = $dispatch(
			'POST',
			'/titlesparks/v1/assets',
			array(
				'asset' => array(
					// The client resolves an upload to an attachment ID; a
					// non-attachment ID must not become a library row.
					'attachment_id' => $published_id,
					'label'         => 'Borrowed attachment',
				),
			),
			$admin_id,
			$admin_nonce
		);

		$assert( 403 === $response['status'], 'A non-attachment ID must be refused with 403, not ' . $response['status'] . '.' );
		$assert(
			'titlesparks_forbidden_attachment' === $response['code'],
			'A non-attachment ID must fail the attachment check (got ' . $response['code'] . ').'
		);
		$assert(
			count( $library->to_editor_list() ) === $count,
			'An asset built from a non-attachment ID must not be added to the library.'
		);

		// An authorised caller cannot smuggle markup through the preview renderer.
		$response = $dispatch(
			'GET',
			'/titlesparks/v1/preview/' . $published_id,
			array(
				'timeline' => array(
					'enabled'          => true,
					'stage_1'          => array(
						'asset_id'      => 'audit-icon',
						'position'      => 'left',
						'duration'      => 2,
						'unit'          => 'days',
						'size'          => '"><script>alert(1)</script>',
						'sizing_rules'  => array(
							array(
								'font' => '"><script>alert(1)</script>',
								'icon' => -5,
							),
							array(
								'font' => 'javascript:alert(1)',
								'icon' => 12,
							),
						),
					),
					'position_offsets' => array(
						'left' => array(
							'x' => '"><script>alert(1)</script>',
							'y' => null,
						),
					),
				),
			),
			$admin_id,
			$admin_nonce
		);

		$assert( 200 === $response['status'], 'Previewing an unsaved timeline must succeed for an administrator (got ' . $response['status'] . ').' );

		$html = is_array( $response['data'] ) && isset( $response['data']['html'] ) ? (string) $response['data']['html'] : '';

		$assert( false === stripos( $html, 'script' ), 'The preview must not echo script markup from a hostile timeline.' );
		$assert( false === stripos( $html, 'javascript:' ), 'The preview must not echo a javascript: URL from a hostile timeline.' );

		// The settings route sanitises everything it stores, including the library.
		$response = $dispatch(
			'POST',
			'/titlesparks/v1/settings',
			array(
				'settings' => array(
					'enabled'         => 'yes<script>alert(1)</script>',
					'post_types'      => array( 'post', '<script>alert(1)</script>', array( 'nested' ), 'page' ),
					'default_stage_1' => array(
						'asset_id' => '<script>alert(1)</script>',
						'duration' => '999999999999999',
						'unit'     => 'decades',
						'size'     => 'expression(alert(1))',
					),
					'assets'          => array(
						array(
							'id'    => 'x"><script>alert(1)</script>',
							'url'   => 'javascript:alert(1)',
							'label' => '<script>alert(1)</script>',
							'tags'  => array( '<b>script</b>' ),
						),
					),
					'folders'         => array(
						array(
							'id'   => '../../etc/passwd',
							'name' => '<script>alert(1)</script>',
							'tags' => array( '<b>script</b>' ),
						),
					),
				),
			),
			$admin_id,
			$admin_nonce
		);

		$assert( 200 === $response['status'], 'The hostile settings payload must be sanitised, not fatal (got ' . $response['status'] . ').' );

		$settings->flush_cache();
		$stored = get_option( Settings::OPTION, array() );
		$flat   = (string) wp_json_encode( $stored );

		$assert( false === stripos( $flat, '<script' ), 'The stored settings must never contain script markup.' );
		$assert( false === stripos( $flat, 'javascript:' ), 'The stored settings must never contain a javascript: URL.' );
		$assert( false === stripos( $flat, 'expression(' ), 'The stored settings must never contain a CSS expression().' );

		$post_types = isset( $stored['post_types'] ) ? $stored['post_types'] : array();
		$assert( is_array( $post_types ), 'The stored post-type list must be an array.' );
		$assert(
			array() === array_filter(
				(array) $post_types,
				static function ( $type ) {
					return ! is_string( $type );
				}
			),
			'The stored post-type list must contain strings only.'
		);
		$assert(
			! in_array( '<script>alert(1)</script>', (array) $post_types, true ),
			'The stored post-type list must not contain submitted markup.'
		);

		$duration = isset( $stored['default_stage_1']['duration'] ) ? (int) $stored['default_stage_1']['duration'] : 0;
		$assert(
			$duration <= Security::max_duration( 'days' ),
			'A hostile stage duration must be clamped to the daily maximum (got ' . $duration . ').'
		);

		$library_after = isset( $stored['assets'] ) ? (array) $stored['assets'] : array();
		$assert( array() === $library_after, 'A javascript: asset submitted through the settings route must not be stored.' );

		/*
		-----------------------------------------------------------------
		 * 7. The classic editor save path.
		 * --------------------------------------------------------------
		 */

		$classic_id = $make_post( $admin_id, 'draft', 'TitleSparks hostile request classic save' );
		$meta       = new Post_Meta();

		$meta->save(
			$classic_id,
			array(
				'enabled' => true,
				'stage_1' => array(
					'asset_id' => 'audit-icon',
					'duration' => 2,
					'unit'     => 'days',
				),
			)
		);

		$stored_meta = get_post_meta( $classic_id, Post_Meta::META_KEY, true );
		$assert( '' !== (string) $stored_meta, 'The classic-save fixture must start with a stored timeline.' );

		$posted_timeline = array(
			'enabled' => '1',
			'stage_1' => array(
				'asset_id' => 'attacker-icon',
				'duration' => '9',
				'unit'     => 'days',
			),
		);

		wp_set_current_user( $admin_id );

		// No nonce at all.
		$_POST    = array( 'titlesparks_timeline' => $posted_timeline ); // phpcs:ignore WordPress.Security.NonceVerification.Missing -- This is the hostile request.
		$_REQUEST = $_POST; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- This is the hostile request.
		$meta->save_from_request( $classic_id, get_post( $classic_id ) );

		$assert(
			get_post_meta( $classic_id, Post_Meta::META_KEY, true ) === $stored_meta,
			'A classic save with no nonce must leave the stored timeline untouched.'
		);

		// A forged nonce.
		$_POST[ Post_Meta::NONCE_FIELD ]    = 'not-a-real-nonce'; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- This is the hostile request.
		$_REQUEST[ Post_Meta::NONCE_FIELD ] = 'not-a-real-nonce'; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- This is the hostile request.
		$meta->save_from_request( $classic_id, get_post( $classic_id ) );

		$assert(
			get_post_meta( $classic_id, Post_Meta::META_KEY, true ) === $stored_meta,
			'A classic save with a forged nonce must leave the stored timeline untouched.'
		);

		// A nonce minted for another post does not unlock this one.
		$other_nonce = wp_create_nonce( Post_Meta::NONCE_ACTION . '_' . $author_draft );

		$_POST[ Post_Meta::NONCE_FIELD ]    = $other_nonce; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- This is the hostile request.
		$_REQUEST[ Post_Meta::NONCE_FIELD ] = $other_nonce; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- This is the hostile request.
		$meta->save_from_request( $classic_id, get_post( $classic_id ) );

		$assert(
			get_post_meta( $classic_id, Post_Meta::META_KEY, true ) === $stored_meta,
			'A nonce minted for another post must not unlock this one.'
		);

		// The real thing still saves.
		$valid_nonce = wp_create_nonce( Post_Meta::NONCE_ACTION . '_' . $classic_id );

		$_POST[ Post_Meta::NONCE_FIELD ]    = $valid_nonce; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified by save_from_request().
		$_REQUEST[ Post_Meta::NONCE_FIELD ] = $valid_nonce; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified by save_from_request().
		$meta->save_from_request( $classic_id, get_post( $classic_id ) );

		$saved = $meta->get( $classic_id );

		$assert( 'attacker-icon' === $saved['stage_1']['asset_id'], 'A classic save with a valid nonce must store the posted asset.' );
		$assert( 9 === (int) $saved['stage_1']['duration'], 'A classic save with a valid nonce must store the posted duration.' );

		/*
		-----------------------------------------------------------------
		 * 8. The registered meta's REST write path.
		 * --------------------------------------------------------------
		 */

		$meta_post_type = (string) get_post_type( $admin_draft );

		if ( registered_meta_key_exists( $meta_post_type, Post_Meta::META_KEY, $meta_post_type ) ) {
			$before_admin_meta = get_post_meta( $admin_draft, Post_Meta::META_KEY, true );

			$response = $dispatch(
				'POST',
				'/wp/v2/posts/' . $admin_draft,
				array(
					'meta' => array(
						Post_Meta::REST_FIELD => '{"enabled":true,"stage_1":{"asset_id":"borrowed"}}',
					),
				),
				$author_id,
				$author_nonce
			);

			$assert(
				400 <= $response['status'],
				'A core REST meta write to another user\'s draft must be refused (got ' . $response['status'] . ').'
			);
			$assert(
				get_post_meta( $admin_draft, Post_Meta::META_KEY, true ) === $before_admin_meta,
				'A refused core REST meta write must leave the meta untouched.'
			);
		} else {
			$skipped[] = 'The timeline meta is not registered for the post type, so the core REST meta write path was not exercised.';
		}

		if ( $failures ) {
			throw new RuntimeException(
				esc_html(
					sprintf(
						"FAIL: %d of %d hostile-request assertions failed:\n - %s",
						count( $failures ),
						$assertions,
						implode( "\n - ", $failures )
					)
				)
			);
		}

		foreach ( $skipped as $notice ) {
			// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- CLI test output; the messages are literals from this file.
			printf( "SKIP: %s\n", $notice );
		}

		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- CLI test summary; the only placeholder is an integer counter.
		printf( "PASS: %d hostile-request assertions\n", $assertions );
	} finally {
		wp_set_current_user( (int) $previous_user );

		// `$wp_rest_auth_cookie` is WordPress core's own global; it has to keep
		// that exact name to be restored.
		// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound
		if ( null === $previous_auth ) {
			unset( $wp_rest_auth_cookie );
		} else {
			$wp_rest_auth_cookie = $previous_auth;
		}
		// phpcs:enable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound

		unset( $_SERVER['HTTP_X_WP_NONCE'] );

		$_POST    = $previous_post;
		$_REQUEST = $previous_request;

		remove_filter( 'rest_send_nocache_headers', '__return_true', 20 );

		if ( $had_option ) {
			update_option( Settings::OPTION, $previous_option );
		} else {
			delete_option( Settings::OPTION );
		}

		$settings->flush_cache();

		foreach ( $created['posts'] as $post_id ) {
			wp_delete_post( $post_id, true );
		}

		if ( $created['users'] ) {
			require_once ABSPATH . 'wp-admin/includes/user.php';

			foreach ( $created['users'] as $user_id ) {
				wp_delete_user( $user_id );
			}
		}
	}
}
