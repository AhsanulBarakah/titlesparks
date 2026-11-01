/**
 * Informational side cards.
 *
 * "How It Works" is the three stage model in three lines; the help card points
 * at the Guide tab, which is where the detail lives. Both are presentational
 * and hold no state.
 *
 * The two carry a tint — blue for the model, green for the help — which is what
 * separates them from the settings cards beside them without an icon-heavy
 * header; each one still leads with a solid mark rather than an outline, so the
 * pair reads as two panels of the same set.
 */

import { __ } from '@wordpress/i18n';

import { Card } from '@titlesparks/shared/ui';
import { IconArrowRight, IconHelp } from '@titlesparks/shared/icons';

/**
 * The three stage steps, in order.
 */
const STEPS = [
	{
		title: __( 'Initial Icon', 'titlesparks' ),
		body: __(
			'Stage 1 shows the freshest marker, for example an animated “News” GIF.',
			'titlesparks'
		),
	},
	{
		title: __( 'Mid Icon', 'titlesparks' ),
		body: __(
			'Stage 2 swaps to a second icon, for example “Hot News Today”.',
			'titlesparks'
		),
	},
	{
		title: __( 'Final Icon', 'titlesparks' ),
		body: __(
			'Stage 3 shows the last icon, or removes it entirely, per your settings.',
			'titlesparks'
		),
	},
];

/**
 * InfoCards component.
 *
 * @param {Object} props
 * @param {string} [props.guideUrl] Guide tab of this page.
 * @return {JSX.Element} The cards.
 */
const InfoCards = ( { guideUrl = '' } ) => (
	<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-5">
		<Card
			className="titlesparks:border-gray-200 titlesparks:bg-white"
			bodyClassName="titlesparks:p-4"
			title={ __( 'How It Works', 'titlesparks' ) }
			description={ __(
				'Each post title carries its own timeline.',
				'titlesparks'
			) }
		>
			<ol className="titlesparks:m-0 titlesparks:flex titlesparks:list-none titlesparks:flex-col titlesparks:gap-3 titlesparks:p-0">
				{ STEPS.map( ( step, index ) => (
					<li
						key={ step.title }
						className="titlesparks:flex titlesparks:gap-2.5"
					>
						<span className="titlesparks:flex titlesparks:h-5 titlesparks:w-5 titlesparks:shrink-0 titlesparks:items-center titlesparks:justify-center titlesparks:rounded-md titlesparks:bg-brand-900 titlesparks:text-xs titlesparks:font-semibold titlesparks:text-white">
							{ index + 1 }
						</span>
						<span>
							<span className="titlesparks:block titlesparks:text-xs titlesparks:font-semibold titlesparks:text-gray-900">
								{ step.title }
							</span>
							<span className="titlesparks:block titlesparks:mt-0.5 titlesparks:text-xs titlesparks:text-gray-600">
								{ step.body }
							</span>
						</span>
					</li>
				) ) }
			</ol>
		</Card>

		<Card
			className="titlesparks:border-gray-200 titlesparks:bg-white"
			bodyClassName="titlesparks:p-4"
		>
			<div className="titlesparks:flex titlesparks:items-center titlesparks:gap-2.5">
				<span className="titlesparks:flex titlesparks:h-6 titlesparks:w-6 titlesparks:shrink-0 titlesparks:items-center titlesparks:justify-center titlesparks:rounded-md titlesparks:bg-brand-900 titlesparks:text-white">
					<IconHelp className="titlesparks:h-4 titlesparks:w-4" />
				</span>
				<h3 className="titlesparks:m-0 titlesparks:text-sm titlesparks:font-semibold titlesparks:text-gray-900">
					{ __( 'Need Help?', 'titlesparks' ) }
				</h3>
			</div>

			<p className="titlesparks:m-0 titlesparks:mt-2 titlesparks:text-xs titlesparks:text-gray-600">
				{ __(
					'Stages, placement, sizes and the timeline start, explained.',
					'titlesparks'
				) }
			</p>

			{ guideUrl && (
				<a
					href={ guideUrl }
					className="titlesparks:mt-3 titlesparks:inline-flex titlesparks:items-center titlesparks:gap-1.5 titlesparks:rounded-lg titlesparks:bg-brand-50 titlesparks:px-3 titlesparks:py-2 titlesparks:text-xs titlesparks:font-medium titlesparks:text-brand-900 titlesparks:transition-colors titlesparks:hover:bg-brand-100"
				>
					{ __( 'Open the Guide', 'titlesparks' ) }
					<IconArrowRight className="titlesparks:h-3.5 titlesparks:w-3.5" />
				</a>
			) }
		</Card>
	</div>
);

export default InfoCards;
