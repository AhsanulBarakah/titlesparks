<?php
/**
 * Classic editor fallback.
 *
 * The block editor sidebar is the primary interface, but a site that has
 * disabled the block editor (or a post type registered with
 * `show_in_rest => false`) would otherwise have no way to configure a
 * timeline. This meta box covers that case with plain server-rendered fields,
 * using the same `Security` validation, the same meta key and the same save
 * path as the REST controller.
 *
 * @package Title_Sparks
 */

namespace Title_Sparks\Admin;

use Title_Sparks\Asset_Library;
use Title_Sparks\Post_Meta;
use Title_Sparks\Security;
use Title_Sparks\Settings;
use Title_Sparks\Traits\Security as Security_Trait;

defined( 'ABSPATH' ) || exit;

/**
 * Class Meta_Box
 */
final class Meta_Box {

	use Security_Trait;

	/**
	 * Meta box ID.
	 */
	const ID = 'titlesparks-decay';

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'add_meta_boxes', array( $this, 'add' ) );
	}

	/**
	 * Add the meta box to every enabled post type that is not using the block
	 * editor.
	 *
	 * @return void
	 */
	public function add() {
		if ( ! Settings::instance()->is_enabled() ) {
			return;
		}

		foreach ( Settings::instance()->enabled_post_types() as $post_type ) {
			// The block editor renders its own sidebar; a meta box there would
			// be a confusing duplicate.
			if ( function_exists( 'use_block_editor_for_post_type' ) && use_block_editor_for_post_type( $post_type ) ) {
				continue;
			}

			add_meta_box(
				self::ID,
				__( 'Title Icon Decay Timeline', 'titlesparks' ),
				array( $this, 'render' ),
				$post_type,
				'side',
				'default'
			);
		}
	}

	/**
	 * Render the fields.
	 *
	 * @param \WP_Post $post Post being edited.
	 * @return void
	 */
	public function render( $post ) {
		if ( ! self::user_can_edit_post( $post->ID ) ) {
			return;
		}

		$timeline = ( new Post_Meta() )->get( $post->ID );
		$assets   = ( new Asset_Library() )->all();

		wp_nonce_field(
			Post_Meta::NONCE_ACTION . '_' . $post->ID,
			Post_Meta::NONCE_FIELD
		);
		?>
		<p>
			<label>
				<input type="checkbox" name="titlesparks_timeline[enabled]" value="1" <?php checked( ! empty( $timeline['enabled'] ) ); ?> />
				<?php esc_html_e( 'Show a decaying icon on this post title', 'titlesparks' ); ?>
			</label>
		</p>

		<?php foreach ( array( 1, 2, 3 ) as $stage_number ) : ?>
			<?php
			$key   = 'stage_' . $stage_number;
			$stage = isset( $timeline[ $key ] ) ? $timeline[ $key ] : array();
			$name  = 'titlesparks_timeline[' . $key . ']';
			?>
			<fieldset style="border:1px solid #dcdcde;padding:8px;margin-bottom:8px;">
				<legend>
					<?php
					printf(
						/* translators: %d: stage number. */
						esc_html__( 'Stage %d', 'titlesparks' ),
						(int) $stage_number
					);
					?>
				</legend>

				<p>
					<label for="titlesparks-asset-<?php echo (int) $stage_number; ?>"><?php esc_html_e( 'Icon', 'titlesparks' ); ?></label><br />
					<select id="titlesparks-asset-<?php echo (int) $stage_number; ?>" name="<?php echo esc_attr( $name ); ?>[asset_id]" style="width:100%">
						<option value=""><?php esc_html_e( '— None —', 'titlesparks' ); ?></option>
						<?php foreach ( $assets as $asset ) : ?>
							<option value="<?php echo esc_attr( $asset['id'] ); ?>" <?php selected( isset( $stage['asset_id'] ) ? $stage['asset_id'] : '', $asset['id'] ); ?>>
								<?php echo esc_html( ( isset( $asset['label'] ) && '' !== $asset['label'] ) ? $asset['label'] : $asset['id'] ); ?>
							</option>
						<?php endforeach; ?>
					</select>
				</p>

				<p>
					<label for="titlesparks-position-<?php echo (int) $stage_number; ?>"><?php esc_html_e( 'Position', 'titlesparks' ); ?></label><br />
					<select id="titlesparks-position-<?php echo (int) $stage_number; ?>" name="<?php echo esc_attr( $name ); ?>[position]" style="width:100%">
						<?php
						$current_position = isset( $stage['position'] ) ? $stage['position'] : '';

						foreach ( Security::position_choices() as $position ) :
							$position_label = ucfirst( str_replace( '-', ' ', $position ) );
							?>
							<option value="<?php echo esc_attr( $position ); ?>" <?php selected( $current_position, $position ); ?>>
								<?php echo esc_html( $position_label ); ?>
							</option>
						<?php endforeach; ?>
					</select>
				</p>

				<p>
					<label for="titlesparks-duration-<?php echo (int) $stage_number; ?>"><?php esc_html_e( 'Lasts for', 'titlesparks' ); ?></label><br />
					<input
						type="number"
						min="0"
						step="1"
						id="titlesparks-duration-<?php echo (int) $stage_number; ?>"
						name="<?php echo esc_attr( $name ); ?>[duration]"
						value="<?php echo esc_attr( isset( $stage['duration'] ) ? (int) $stage['duration'] : 0 ); ?>"
						style="width:5em"
					/>
					<select name="<?php echo esc_attr( $name ); ?>[unit]" aria-label="<?php esc_attr_e( 'Unit', 'titlesparks' ); ?>">
						<?php foreach ( Security::allowed_units() as $unit ) : ?>
							<option value="<?php echo esc_attr( $unit ); ?>" <?php selected( isset( $stage['unit'] ) ? $stage['unit'] : '', $unit ); ?>>
								<?php echo esc_html( ucfirst( $unit ) ); ?>
							</option>
						<?php endforeach; ?>
					</select>
				</p>

				<p>
					<label for="titlesparks-size-<?php echo (int) $stage_number; ?>"><?php esc_html_e( 'Icon size', 'titlesparks' ); ?></label><br />
					<input
						type="text"
						id="titlesparks-size-<?php echo (int) $stage_number; ?>"
						name="<?php echo esc_attr( $name ); ?>[size]"
						value="<?php echo esc_attr( isset( $stage['size'] ) ? $stage['size'] : '' ); ?>"
						placeholder="<?php esc_attr_e( 'From the asset, e.g. 24px', 'titlesparks' ); ?>"
						style="width:8em"
					/>
				</p>
			</fieldset>
		<?php endforeach; ?>

		<p>
			<label for="titlesparks-behaviour"><?php esc_html_e( 'After stage 3 ends', 'titlesparks' ); ?></label><br />
			<select id="titlesparks-behaviour" name="titlesparks_timeline[stage_3_behaviour]" style="width:100%">
				<?php foreach ( Security::allowed_behaviours() as $behaviour ) : ?>
					<option value="<?php echo esc_attr( $behaviour ); ?>" <?php selected( isset( $timeline['stage_3_behaviour'] ) ? $timeline['stage_3_behaviour'] : '', $behaviour ); ?>>
						<?php
						echo esc_html(
							'keep' === $behaviour
								? __( 'Keep the last icon forever', 'titlesparks' )
								: __( 'Remove the icon', 'titlesparks' )
						);
						?>
					</option>
				<?php endforeach; ?>
			</select>
		</p>

		<p class="description">
			<?php esc_html_e( 'The countdown starts where the plugin settings say the timeline starts — the post date by default. Save the post to apply.', 'titlesparks' ); ?>
		</p>
		<?php
	}
}
