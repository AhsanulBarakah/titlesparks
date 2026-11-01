<?php
/**
 * The decay engine.
 *
 * Pure calculation, with no WordPress side effects beyond reading the post
 * date: given a timeline and a moment in time, it answers "which stage is
 * active?". Keeping it free of rendering concerns is what makes a stage
 * boundary predictable — it can never depend on cache state or template
 * context.
 *
 * Timeline model
 * --------------
 * Stage 1 runs from the anchor (the post date unless overridden) for its
 * `duration` in days. Stage 2 starts when stage 1 ends and runs for its own
 * duration. Stage 3 starts when stage 2 ends and runs for its own duration.
 * After stage 3 ends the timeline has fully elapsed: with the `keep` behaviour
 * the icon of the newest stage that actually has one stays forever, with
 * `remove` nothing is rendered any more.
 *
 * "The newest stage that actually has one" matters because the three stage
 * slots are independent: an author who fills in stage 1 and leaves 2 and 3
 * untouched has still configured a decaying icon, and `keep` has to keep the
 * icon they picked rather than the empty slot that happens to come last.
 *
 * @package Title_Sparks
 */

namespace Title_Sparks;

defined( 'ABSPATH' ) || exit;

/**
 * Class Decay
 */
final class Decay {

	/**
	 * Seconds in one hour.
	 */
	const HOUR_IN_SECONDS = 3600;

	/**
	 * Stage 1: the freshest look.
	 */
	const STAGE_1 = 1;

	/**
	 * Stage 2: still recent.
	 */
	const STAGE_2 = 2;

	/**
	 * Stage 3: the last look before expiry.
	 */
	const STAGE_3 = 3;

	/**
	 * Nothing is shown any more.
	 */
	const STAGE_EXPIRED = 0;

	/**
	 * Newest stage that has an icon selected.
	 *
	 * An empty `asset_id` means the author never configured that slot, which is
	 * not the same thing as choosing to show no icon.
	 *
	 * @param array $stages Stage data keyed by stage number.
	 * @return int Stage number (1-3), or 0 when no stage has an icon at all.
	 */
	public static function last_configured_stage( array $stages ) {
		foreach ( array_reverse( $stages, true ) as $stage_number => $stage ) {
			$asset_id = isset( $stage['asset_id'] ) ? (string) $stage['asset_id'] : '';

			if ( '' !== $asset_id ) {
				return (int) $stage_number;
			}
		}

		return 0;
	}

	/**
	 * Convert a stage duration to seconds.
	 *
	 * A duration of zero disables the stage entirely.
	 *
	 * @param array $stage Stage data.
	 * @return int
	 */
	public static function stage_seconds( array $stage ) {
		$duration = isset( $stage['duration'] ) ? (int) $stage['duration'] : 0;

		if ( $duration <= 0 ) {
			return 0;
		}

		$unit = isset( $stage['unit'] ) ? $stage['unit'] : 'days';

		switch ( $unit ) {
			case 'minutes':
				return $duration * MINUTE_IN_SECONDS;
			case 'hours':
				return $duration * self::HOUR_IN_SECONDS;
			default:
				return $duration * DAY_IN_SECONDS;
		}
	}

	/**
	 * The anchor a timeline resolves from.
	 *
	 * The timeline's own anchor wins; otherwise the anchor handed in by the
	 * caller (the site wide "timeline starts" setting) is used. An empty result
	 * is not an error — it means "fall back to the post's publish date", which
	 * `anchor_timestamp()` does.
	 *
	 * @param array  $timeline Sanitized timeline.
	 * @param string $anchor   Anchor from the caller.
	 * @return string
	 */
	private static function anchor_value( array $timeline, $anchor ) {
		if ( isset( $timeline['anchor'] ) && '' !== $timeline['anchor'] ) {
			return $timeline['anchor'];
		}

		return is_string( $anchor ) ? $anchor : '';
	}

	/**
	 * Unix timestamp at which the timeline starts.
	 *
	 * @param int    $post_id Post ID.
	 * @param string $anchor  Optional explicit anchor (`Y-m-d H:i:s`, site time).
	 * @return int Zero when the post (and the anchor) cannot be resolved.
	 */
	public static function anchor_timestamp( $post_id, $anchor = '' ) {
		// Everything is expressed on WordPress' "local" clock, so that
		// `current_time( 'timestamp' ) - get_the_time( 'U' )` is the true
		// elapsed time regardless of the site timezone.
		$offset = self::local_offset();

		if ( '' !== $anchor ) {
			$timezone = function_exists( 'wp_timezone' ) ? wp_timezone() : new \DateTimeZone( 'UTC' );
			$date     = date_create( $anchor, $timezone );

			if ( $date ) {
				return (int) $date->getTimestamp() + $offset;
			}
		}

		$post = get_post( $post_id );

		if ( ! $post ) {
			return 0;
		}

		// `get_the_time( 'U' )` returns the publish time on the site clock,
		// which is exactly the value the elapsed formula expects.
		return (int) get_post_time( 'U', false, $post );
	}

	/**
	 * Difference between the site clock and UTC, in seconds.
	 *
	 * Expressed as an offset so `current_time( 'timestamp' )` and the anchor
	 * share the same base and simply subtract.
	 *
	 * @return int
	 */
	public static function local_offset() {
		return function_exists( 'current_time' ) ? ( (int) current_time( 'timestamp' ) - time() ) : 0;
	}

	/**
	 * Compute which stage is active right now.
	 *
	 * @param array  $timeline Sanitized timeline.
	 * @param int    $post_id  Post ID.
	 * @param int    $now      Optional "current time" timestamp (for tests).
	 * @param string $anchor   Optional anchor to use instead of the one stored in
	 *                         the timeline (`Y-m-d H:i:s`, site time). The
	 *                         settings page can start every post's timeline at a
	 *                         fixed date, and this is how that reaches the maths.
	 * @return array{stage: int, expired: bool, anchor: int, elapsed: int, ends_at: int, remaining: int}
	 */
	public static function resolve( array $timeline, $post_id = 0, $now = 0, $anchor = '' ) {
		$now    = $now ? (int) $now : (int) current_time( 'timestamp' );
		$anchor = self::anchor_timestamp( $post_id, self::anchor_value( $timeline, $anchor ) );

		$result = array(
			'stage'     => self::STAGE_EXPIRED,
			'expired'   => true,
			'anchor'    => $anchor,
			'elapsed'   => 0,
			'ends_at'   => $anchor,
			'remaining' => 0,
		);

		if ( ! $anchor ) {
			return $result;
		}

		// A post scheduled in the future has not started decaying yet: it is
		// always stage 1, and the countdown begins when it goes live.
		$elapsed = max( 0, $now - $anchor );

		$result['elapsed'] = $elapsed;

		$stages = array(
			self::STAGE_1 => isset( $timeline['stage_1'] ) ? $timeline['stage_1'] : array(),
			self::STAGE_2 => isset( $timeline['stage_2'] ) ? $timeline['stage_2'] : array(),
			self::STAGE_3 => isset( $timeline['stage_3'] ) ? $timeline['stage_3'] : array(),
		);

		$cursor = $anchor;

		foreach ( $stages as $stage_number => $stage ) {
			$seconds = self::stage_seconds( $stage );
			$ends_at = $cursor + $seconds;

			// A zero-length stage is skipped rather than shown for an instant;
			// this is how an author disables a middle stage.
			if ( $seconds > 0 && $elapsed < ( $ends_at - $anchor ) ) {
				$result['stage']     = $stage_number;
				$result['expired']   = false;
				$result['ends_at']   = $ends_at;
				$result['remaining'] = max( 0, $ends_at - $now );

				return $result;
			}

			$cursor = $ends_at;
		}

		// Every stage has elapsed.
		$behaviour = isset( $timeline['stage_3_behaviour'] ) ? $timeline['stage_3_behaviour'] : 'keep';

		if ( 'keep' === $behaviour ) {
			// `keep` promises that an icon stays on the title, so it has to keep
			// an icon that was actually picked. Stage 3 is only the literal last
			// slot: an author who filled in stage 1 and left 3 empty never chose
			// an icon for it, and returning stage 3 would render nothing at all
			// while the settings still say "Keep Icon Permanently".
			$kept = self::last_configured_stage( $stages );

			if ( $kept > 0 ) {
				$result['stage']   = $kept;
				$result['expired'] = true;
				$result['ends_at'] = $cursor;
			}
		}

		// With `remove`, or with no icon configured in any stage, the result
		// stays STAGE_EXPIRED and nothing is rendered.
		return $result;
	}

	/**
	 * Total length of a timeline in seconds.
	 *
	 * @param array $timeline Sanitized timeline.
	 * @return int
	 */
	public static function total_seconds( array $timeline ) {
		$total = 0;

		foreach ( Security::stage_keys() as $key ) {
			$total += self::stage_seconds( isset( $timeline[ $key ] ) ? $timeline[ $key ] : array() );
		}

		return $total;
	}

	/**
	 * Start and end of every stage in a timeline, in Unix time.
	 *
	 * A cached page has to make the same decision `resolve()` makes, hours after
	 * the page was written, so the boundaries are calculated here once and
	 * handed to the browser. A zero length stage is listed with the same start
	 * and end, which is what tells the browser to skip it exactly as
	 * `resolve()` does.
	 *
	 * @param array  $timeline Sanitized timeline.
	 * @param int    $post_id  Post ID.
	 * @param string $anchor   Optional anchor to use instead of the stored one.
	 * @return array<int,array{stage:int,start:int,end:int}> One row per stage.
	 */
	public static function stage_boundaries( array $timeline, $post_id = 0, $anchor = '' ) {
		$cursor  = self::anchor_timestamp( $post_id, self::anchor_value( $timeline, $anchor ) );
		$rows    = array();

		foreach ( array( self::STAGE_1, self::STAGE_2, self::STAGE_3 ) as $stage_number ) {
			$key  = 'stage_' . $stage_number;
			$ends = $cursor + self::stage_seconds( isset( $timeline[ $key ] ) ? $timeline[ $key ] : array() );

			$rows[] = array(
				'stage' => $stage_number,
				'start' => $cursor,
				'end'   => $ends,
			);

			$cursor = $ends;
		}

		return $rows;
	}

	/**
	 * Timestamp at which a given stage starts, for the editor preview.
	 *
	 * @param array  $timeline Sanitized timeline.
	 * @param int    $post_id  Post ID.
	 * @param int    $stage    Stage number (1-3).
	 * @param string $anchor   Optional anchor to use instead of the stored one.
	 * @return int
	 */
	public static function stage_start( array $timeline, $post_id, $stage, $anchor = '' ) {
		$start = self::anchor_timestamp( $post_id, self::anchor_value( $timeline, $anchor ) );

		for ( $index = 1; $index < (int) $stage; $index++ ) {
			$key = 'stage_' . $index;

			$start += self::stage_seconds( isset( $timeline[ $key ] ) ? $timeline[ $key ] : array() );
		}

		return $start;
	}

	/**
	 * Human readable summary of a resolved stage, used by the editor preview.
	 *
	 * @param array $resolved Result of ::resolve().
	 * @return string
	 */
	public static function describe( array $resolved ) {
		if ( self::STAGE_EXPIRED === $resolved['stage'] ) {
			return __( 'Expired — no icon is shown.', 'titlesparks' );
		}

		if ( ! empty( $resolved['expired'] ) ) {
			/* translators: %d: stage number. */
			return sprintf( __( 'Stage %d is shown permanently.', 'titlesparks' ), (int) $resolved['stage'] );
		}

		return sprintf(
			/* translators: 1: stage number, 2: human readable time difference. */
			__( 'Stage %1$d — changes in %2$s.', 'titlesparks' ),
			(int) $resolved['stage'],
			human_time_diff( time(), time() + (int) $resolved['remaining'] )
		);
	}
}
