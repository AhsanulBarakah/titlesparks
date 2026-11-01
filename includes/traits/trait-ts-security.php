<?php
/**
 * The single place where untrusted data and untrusted requests are handled.
 *
 * Every class that reads request data, writes post meta or persists settings
 * composes this trait, so that nonce verification, capability checks and data
 * sanitisation always take one identical, auditable path:
 *
 *     final class Rest_Controller {
 *         use \Title_Sparks\Traits\Security;
 *         ...
 *     }
 *
 * The guard methods (`require_nonce()`, `require_manage_options()`,
 * `require_edit_post()`) stop execution with a correct HTTP status when a check
 * fails. The `sanitize_*()` methods always return a fully formed value of the
 * expected type — never `null` — so calling code cannot accidentally leak an
 * unsanitised value into the database. The `escape_*()` methods are the
 * matching output helpers; escaping happens at the point of output, not at the
 * point of storage.
 *
 * @package Title_Sparks
 */

namespace Title_Sparks\Traits;

defined( 'ABSPATH' ) || exit;

/**
 * Trait Security
 */
trait Security {

	/* ---------------------------------------------------------------------
	 * Nonce verification.
	 * ------------------------------------------------------------------ */

	/**
	 * Strictly verify a nonce value against an action.
	 *
	 * @param mixed  $nonce  Nonce value, ideally straight from the request.
	 * @param string $action Nonce action it was created with.
	 * @return bool True when the nonce is valid for the action.
	 */
	public static function verify_nonce( $nonce, $action ) {
		if ( ! is_string( $nonce ) || '' === $nonce ) {
			return false;
		}

		return (bool) wp_verify_nonce( $nonce, $action );
	}

	/**
	 * Read a nonce out of the request and verify it.
	 *
	 * @param string $action Nonce action.
	 * @param string $name   Request key holding the nonce.
	 * @return bool
	 */
	protected function check_nonce( $action, $name = '_wpnonce' ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- This method is the nonce verification; the request value is the nonce itself.
		if ( ! isset( $_REQUEST[ $name ] ) || ! is_scalar( $_REQUEST[ $name ] ) ) {
			return false;
		}

		$nonce = sanitize_text_field( wp_unslash( (string) $_REQUEST[ $name ] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- The nonce is verified on the next line.

		return self::verify_nonce( $nonce, $action );
	}

	/**
	 * Verify the request nonce, or stop the request.
	 *
	 * @param string $action Nonce action.
	 * @param string $name   Request key holding the nonce.
	 * @return void
	 */
	protected function require_nonce( $action, $name = '_wpnonce' ) {
		if ( ! $this->check_nonce( $action, $name ) ) {
			$this->deny(
				__( 'The security check failed. Please reload the page and try again.', 'titlesparks' )
			);
		}
	}

	/**
	 * Verify the REST API nonce (`X-WP-Nonce` / `wp_rest`).
	 *
	 * @param mixed $nonce Nonce value, e.g. `$request->get_header( 'X-WP-Nonce' )`.
	 * @return bool
	 */
	protected function check_rest_nonce( $nonce ) {
		return self::verify_nonce( $nonce, 'wp_rest' );
	}

	/**
	 * Verify an admin-ajax nonce without dying, so callers can return JSON.
	 *
	 * @param string $action    Nonce action.
	 * @param string $query_arg Request key holding the nonce.
	 * @return bool
	 */
	protected function check_ajax_nonce( $action, $query_arg = 'nonce' ) {
		return false !== check_ajax_referer( $action, $query_arg, false );
	}

	/* ---------------------------------------------------------------------
	 * Capability checks.
	 * ------------------------------------------------------------------ */

	/**
	 * Whether the current user may manage the plugin settings.
	 *
	 * @return bool
	 */
	public static function user_can_manage_options() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Require `manage_options`, or stop the request.
	 *
	 * @return void
	 */
	protected function require_manage_options() {
		if ( ! self::user_can_manage_options() ) {
			$this->deny(
				__( 'You are not allowed to manage TitleSparks settings.', 'titlesparks' )
			);
		}
	}

	/**
	 * Whether the current user may edit a specific post.
	 *
	 * `edit_post` is a meta capability, so it must be checked against a real
	 * post ID rather than the plural `edit_posts` capability.
	 *
	 * @param mixed $post_id Post ID to check.
	 * @return bool
	 */
	public static function user_can_edit_post( $post_id ) {
		$post_id = absint( $post_id );

		if ( ! $post_id ) {
			return false;
		}

		return current_user_can( 'edit_post', $post_id );
	}

	/**
	 * Require `edit_post` for a post, or stop the request.
	 *
	 * @param mixed $post_id Post ID to check.
	 * @return void
	 */
	protected function require_edit_post( $post_id ) {
		if ( ! self::user_can_edit_post( $post_id ) ) {
			$this->deny(
				__( 'You are not allowed to edit this post.', 'titlesparks' )
			);
		}
	}

	/**
	 * Stop the request with a sanitised message and the right status code.
	 *
	 * @param string $message     Human readable reason.
	 * @param int    $status_code HTTP status code.
	 * @return void
	 */
	protected function deny( $message, $status_code = 403 ) {
		wp_die(
			esc_html( $message ),
			esc_html__( 'TitleSparks', 'titlesparks' ),
			array( 'response' => (int) $status_code )
		);
	}

	/* ---------------------------------------------------------------------
	 * Sanitisation handlers. Each one returns a value of a known type.
	 * ------------------------------------------------------------------ */

	/**
	 * Sanitise a single line of text.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function sanitize_text( $value ) {
		return is_scalar( $value ) ? sanitize_text_field( (string) $value ) : '';
	}

	/**
	 * Sanitise multi-line text.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function sanitize_textarea( $value ) {
		return is_scalar( $value ) ? sanitize_textarea_field( (string) $value ) : '';
	}

	/**
	 * Sanitise a slug/key.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function sanitize_key( $value ) {
		return is_scalar( $value ) ? sanitize_key( (string) $value ) : '';
	}

	/**
	 * Sanitise an HTML class name.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function sanitize_html_class( $value ) {
		return is_scalar( $value ) ? sanitize_html_class( (string) $value ) : '';
	}

	/**
	 * Sanitise an email address.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function sanitize_email( $value ) {
		return is_scalar( $value ) ? sanitize_email( (string) $value ) : '';
	}

	/**
	 * Sanitise and clamp an integer.
	 *
	 * @param mixed    $value Raw value.
	 * @param int|null $min   Lower bound, inclusive.
	 * @param int|null $max   Upper bound, inclusive.
	 * @return int
	 */
	public static function sanitize_int( $value, $min = null, $max = null ) {
		$value = is_numeric( $value ) ? (int) $value : 0;

		if ( null !== $min ) {
			$value = max( (int) $min, $value );
		}

		if ( null !== $max ) {
			$value = min( (int) $max, $value );
		}

		return $value;
	}

	/**
	 * Sanitise a boolean flag, accepting common truthy string forms.
	 *
	 * @param mixed $value Raw value.
	 * @return bool
	 */
	public static function sanitize_bool( $value ) {
		if ( is_bool( $value ) ) {
			return $value;
		}

		if ( is_string( $value ) ) {
			return in_array( strtolower( trim( $value ) ), array( '1', 'true', 'yes', 'on' ), true );
		}

		return (bool) $value;
	}

	/**
	 * Sanitise a URL that must point somewhere over http(s).
	 *
	 * @param mixed $value Raw value.
	 * @return string Empty string when the scheme is not http(s).
	 */
	public static function sanitize_url( $value ) {
		$url = is_scalar( $value ) ? esc_url_raw( (string) $value ) : '';

		// Reject `javascript:` / `data:` and anything else that could turn a
		// stored value into an injection vector at render time.
		return preg_match( '#^https?://#i', $url ) ? $url : '';
	}

	/**
	 * Sanitise a value that must be one of a fixed allow-list.
	 *
	 * @param mixed    $value   Raw value.
	 * @param string[] $allowed Allowed values.
	 * @param string   $default Fallback when the value is not allowed.
	 * @return string
	 */
	public static function sanitize_choice( $value, array $allowed, $default = '' ) {
		$value = is_scalar( $value ) ? (string) $value : '';

		return in_array( $value, $allowed, true ) ? $value : $default;
	}

	/**
	 * Sanitise a list of scalar values, alias-free and de-duplicated.
	 *
	 * @param mixed    $value     Raw value (array or comma/space separated string).
	 * @param callable $sanitizer Sanitizer applied to each item.
	 * @return array<int, string>
	 */
	public static function sanitize_list( $value, $sanitizer = 'sanitize_key' ) {
		if ( is_string( $value ) ) {
			$value = preg_split( '/[\s,]+/', $value, -1, PREG_SPLIT_NO_EMPTY );
		}

		if ( ! is_array( $value ) ) {
			return array();
		}

		$clean = array();

		foreach ( $value as $item ) {
			if ( ! is_scalar( $item ) ) {
				continue;
			}

			$item = call_user_func( $sanitizer, (string) $item );

			if ( '' !== $item ) {
				$clean[] = $item;
			}
		}

		return array_values( array_unique( $clean ) );
	}

	/**
	 * Sanitise a CSS length (for example an icon size).
	 *
	 * @param mixed $value Raw value.
	 * @return string Empty string when the value could break out of a declaration.
	 */
	public static function sanitize_css_size( $value ) {
		$value = is_scalar( $value ) ? trim( (string) $value ) : '';

		// Decimals are allowed (`1.5em`) but anything that could inject a second
		// declaration (`20px;color:red`) is rejected.
		return preg_match( '/^\d{1,4}(\.\d{1,3})?(px|em|rem|%|vw|vh)$/', $value ) ? $value : '';
	}

	/* ---------------------------------------------------------------------
	 * Escaping handlers. Applied at the point of output.
	 * ------------------------------------------------------------------ */

	/**
	 * Escape a value for HTML text context.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function escape_html( $value ) {
		return esc_html( is_scalar( $value ) ? (string) $value : '' );
	}

	/**
	 * Escape a value for an HTML attribute context.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function escape_attr( $value ) {
		return esc_attr( is_scalar( $value ) ? (string) $value : '' );
	}

	/**
	 * Escape a value for a URL context.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function escape_url( $value ) {
		return esc_url( is_scalar( $value ) ? (string) $value : '' );
	}

	/**
	 * Escape a value for a textarea context.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function escape_textarea( $value ) {
		return esc_textarea( is_scalar( $value ) ? (string) $value : '' );
	}

	/* ---------------------------------------------------------------------
	 * Helpers.
	 * ------------------------------------------------------------------ */

	/**
	 * Recursively strip WordPress' magic slashes from a payload.
	 *
	 * WordPress slashes every value in `$_POST`/`$_GET`; without this a stored
	 * string containing an apostrophe would keep a stray backslash.
	 *
	 * @param mixed $value Raw value.
	 * @return mixed
	 */
	public static function deep_unslash( $value ) {
		if ( is_array( $value ) ) {
			return array_map( array( __CLASS__, 'deep_unslash' ), $value );
		}

		return is_string( $value ) ? wp_unslash( $value ) : $value;
	}
}
