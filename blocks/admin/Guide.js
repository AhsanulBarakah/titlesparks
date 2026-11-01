/**
 * The Guide tab.
 *
 * Everything the editor deliberately does not say. The sidebar is a control
 * panel, so the rules behind it — how a stage ends, where a timeline starts,
 * what an offset is measured from, which size wins — are collected here, where
 * an author can read them once instead of meeting them on every screen.
 *
 * Presentational only: no state, no requests, so it works on a site where the
 * REST routes are unavailable.
 */

import { __, sprintf } from '@wordpress/i18n';

import { Badge, Card } from '@titlesparks/shared/ui';
import { IconArrowRight } from '@titlesparks/shared/icons';

/**
 * One titled block of the guide.
 *
 * @param {Object}      props
 * @param {string}      props.title         Section heading.
 * @param {string}      [props.description] One line under the heading.
 * @param {JSX.Element} props.children      Definitions.
 * @return {JSX.Element} The section.
 */
const Section = ( { title, description, children } ) => (
	<Card
		title={ title }
		description={ description }
		bodyClassName="titlesparks:p-4"
	>
		<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-3.5">
			{ children }
		</div>
	</Card>
);

/**
 * One term and its explanation.
 *
 * @param {Object}      props
 * @param {string}      props.term
 * @param {JSX.Element} props.children
 * @return {JSX.Element} One term and its explanation.
 */
const Item = ( { term, children } ) => (
	<div className="titlesparks:border-l-2 titlesparks:border-gray-200 titlesparks:py-0.5 titlesparks:pl-3">
		<span className="titlesparks:block titlesparks:text-sm titlesparks:font-semibold titlesparks:text-gray-900">
			{ term }
		</span>
		<span className="titlesparks:block titlesparks:mt-1 titlesparks:text-xs titlesparks:leading-5 titlesparks:text-gray-600">
			{ children }
		</span>
	</div>
);

/**
 * Guide component.
 *
 * @param {Object} props
 * @param {string} [props.settingsUrl] Settings tab of this page.
 * @return {JSX.Element} The guide tab.
 */
const Guide = ( { settingsUrl = '' } ) => (
	<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-4">
		<Card
			className="titlesparks:border-gray-200 titlesparks:bg-white"
			bodyClassName="titlesparks:p-4"
		>
			<div className="titlesparks:flex titlesparks:flex-wrap titlesparks:items-center titlesparks:gap-2">
				<Badge tone="brand">
					{ __( 'How it works', 'titlesparks' ) }
				</Badge>
				<p className="titlesparks:m-0 titlesparks:text-xs titlesparks:text-gray-700">
					{ __(
						'Each title shows one icon at a time. The icon changes as the post ages, then stops or stays, depending on your settings.',
						'titlesparks'
					) }
				</p>
			</div>

			<div className="titlesparks:mt-3 titlesparks:flex titlesparks:flex-wrap titlesparks:gap-2">
				{ [ 1, 2, 3 ].map( ( index ) => (
					<span
						key={ index }
						className="titlesparks:inline-flex titlesparks:items-center titlesparks:gap-1.5 titlesparks:rounded-full titlesparks:border titlesparks:border-gray-200 titlesparks:bg-white titlesparks:px-2.5 titlesparks:py-1 titlesparks:text-xs titlesparks:text-gray-700"
					>
						<span className="titlesparks:flex titlesparks:h-4 titlesparks:w-4 titlesparks:items-center titlesparks:justify-center titlesparks:rounded-full titlesparks:bg-brand-900 titlesparks:text-xs titlesparks:font-semibold titlesparks:text-white">
							{ index }
						</span>
						{ 1 === index && __( 'Initial icon', 'titlesparks' ) }
						{ 2 === index && __( 'Mid icon', 'titlesparks' ) }
						{ 3 === index &&
							__(
								'Final icon, then your choice',
								'titlesparks'
							) }
					</span>
				) ) }
			</div>
		</Card>

		<div className="titlesparks:grid titlesparks:grid-cols-1 titlesparks:gap-4 titlesparks:lg:grid-cols-2">
			<Section
				title={ __( 'Stages', 'titlesparks' ) }
				description={ __(
					'Stages run one after another, never at the same time.',
					'titlesparks'
				) }
			>
				<Item term={ __( 'End of a stage', 'titlesparks' ) }>
					{ __(
						'Each stage ends on the date and time you pick in the editor. That is also its length, measured from where the stage starts.',
						'titlesparks'
					) }
				</Item>
				<Item term={ __( 'Skipping a stage', 'titlesparks' ) }>
					{ __(
						'Clear the End field. The stage then ends when the one before it does, so nothing shows it — a way to use two icons instead of three.',
						'titlesparks'
					) }
				</Item>
				<Item term={ __( 'Times', 'titlesparks' ) }>
					{ __(
						'Every date and time is the site\u2019s clock, not the visitor\u2019s. A post published in Lagos changes at the same moment everywhere.',
						'titlesparks'
					) }
				</Item>
				<Item term={ __( 'After stage 3', 'titlesparks' ) }>
					{ __(
						'Keep the last icon that has one, or remove the icon entirely.',
						'titlesparks'
					) }
				</Item>
			</Section>

			<Section
				title={ __( 'Where a timeline starts', 'titlesparks' ) }
				description={ __(
					'One choice for the whole site, on the Settings tab.',
					'titlesparks'
				) }
			>
				<Item
					term={ __( 'The post\u2019s publish date', 'titlesparks' ) }
				>
					{ __(
						'The default. A post published at 09:00 starts counting at 09:00.',
						'titlesparks'
					) }
				</Item>
				<Item
					term={ __( 'A date and time you choose', 'titlesparks' ) }
				>
					{ __(
						'Every post counts from the same moment, whatever its publish date. Useful for a launch or an event.',
						'titlesparks'
					) }
				</Item>
				<Item term={ __( 'A post that keeps its own', 'titlesparks' ) }>
					{ __(
						'A post saved before this setting existed keeps the anchor it has, so its timeline does not jump.',
						'titlesparks'
					) }
				</Item>
			</Section>

			<Section
				title={ __( 'Position', 'titlesparks' ) }
				description={ __(
					'Where the icon sits against the title.',
					'titlesparks'
				) }
			>
				<Item term={ __( 'Left or right', 'titlesparks' ) }>
					{ __(
						'The icon sits to the left or right of the title. The offset fields move it anywhere from there, including above or below.',
						'titlesparks'
					) }
				</Item>
				<Item
					term={ __(
						'Offset is space, not coordinates',
						'titlesparks'
					) }
				>
					{ __(
						'A positive X moves the icon right and a positive Y moves it down; negative values move it left and up. Both fields work the same way on either side.',
						'titlesparks'
					) }
				</Item>
				<Item term={ __( 'Per position', 'titlesparks' ) }>
					{ __(
						'An offset belongs to the position, so all three stages that use that position share it. Reset returns it to the placement the position\u2019s name promises.',
						'titlesparks'
					) }
				</Item>
				<Item term={ __( 'Facing the other way', 'titlesparks' ) }>
					{ __(
						'Some icons \u2014 an arrow, a hand, a face \u2014 point one way. Every stage has a Flip horizontally checkbox that mirrors that stage\u2019s icon, in the editor and on your site, without changing the library asset or any other stage.',
						'titlesparks'
					) }
				</Item>
			</Section>

			<Section
				title={ __( 'Editor and your site', 'titlesparks' ) }
				description={ __(
					'Why the same icon can look slightly different in the two places.',
					'titlesparks'
				) }
			>
				<Item term={ __( 'Measured, not assumed', 'titlesparks' ) }>
					{ __(
						'The icon is placed by measuring the title\u2019s real text on the page it is drawn on, so your theme\u2019s font, weight and size decide the gap. A theme cannot move the icon wrongly, because nothing about it is guessed in advance.',
						'titlesparks'
					) }
				</Item>
				<Item
					term={ __(
						'The preview may look different',
						'titlesparks'
					) }
				>
					{ __(
						'The block editor draws the title in your theme\u2019s own type only when the theme shares its styles with the editor. When it does not, the canvas uses the editor\u2019s font and size instead. The icon keeps its place on the letters as the title changes size, so a nudge means the same thing in both — but the letters themselves are drawn differently, and no setting can change that: the published page shows your theme\u2019s type.',
						'titlesparks'
					) }
				</Item>
				<Item
					term={ __(
						'When there is no room beside the title',
						'titlesparks'
					) }
				>
					{ __(
						'The icon stands beside the title in the space your theme leaves around the heading. A card in a widget owns that space instead, and may cut off whatever leaves it. Settings \u2192 Fit icons inside tight cards decides whether a card draws an icon smaller so it fits, or leaves it exactly as you placed it.',
						'titlesparks'
					) }
				</Item>
				<Item
					term={ __(
						'In front of your theme\u2019s layers',
						'titlesparks'
					) }
				>
					{ __(
						'The icon is drawn above the title\u2019s words already. If your theme stacks its own elements over the heading \u2014 a ribbon, a badge, a hover overlay \u2014 Settings \u2192 Icon stacking order decides where the icon belongs among them. 0 is the page\u2019s normal order, a higher number brings it forward and a negative one sends it behind; the editor and your site use the same number.',
						'titlesparks'
					) }
				</Item>
				<Item
					term={ __( 'Offsets grow with the title', 'titlesparks' ) }
				>
					{ __(
						'An offset is a distance on the title, so it is measured against the title\u2019s font size — like the gap, and like the letters the icon sits over. A nudge you settle on in the editor is the same part of the same letter on the page, whichever size your theme draws the title at there.',
						'titlesparks'
					) }
				</Item>
				<Item term={ __( 'Titles that wrap', 'titlesparks' ) }>
					{ __(
						'A title that wraps onto a second or third line is measured again, so the icon keeps the place you gave it. By default it is anchored to the first line: your X and Y count from that line, a side icon sits beside that line\u2019s own words rather than beyond the longest line in the title, and adding lines below it leaves the icon where it is. Settings \u2192 Icon lines up with also offers **Last line of the title**, which counts from the end of the words and puts a side icon after that line\u2019s last word, and **Middle of the whole title**, which centres the icon on all the lines together and measures a side icon from the widest line.',
						'titlesparks'
					) }
				</Item>
				<Item term={ __( 'Measured again by itself', 'titlesparks' ) }>
					{ __(
						'Placement is measured once your fonts load, when the window is resized and whenever the page changes, so a title that reflows puts the icon back without you doing anything.',
						'titlesparks'
					) }
				</Item>
			</Section>

			<Section
				title={ __( 'An icon inside a card', 'titlesparks' ) }
				description={ __(
					'What happens when a widget card is narrower than the icon.',
					'titlesparks'
				) }
			>
				<Item
					term={ __( 'Cards have no room to give', 'titlesparks' ) }
				>
					{ __(
						'A post title may use the space your theme leaves beside it, but a card in a sidebar list or a slider does not own that space. Some themes cut off whatever leaves a card; the theme measured here does not, so an icon that cannot fit simply reaches past the edge. Either way the room beside the words is limited, which is why this setting exists.',
						'titlesparks'
					) }
				</Item>
				<Item
					term={ __(
						'Off leaves the icon exactly as it is',
						'titlesparks'
					) }
				>
					{ __(
						'With the switch off, nothing is resized: the icon keeps the size and offset you set, in every card. If the card is narrower than the icon and its gap, the icon reaches past the card edge, and your theme decides whether that part is shown.',
						'titlesparks'
					) }
				</Item>
				<Item
					term={ __(
						'On fits the icon inside the card',
						'titlesparks'
					) }
				>
					{ __(
						'With the switch on, an icon the card would cut off is drawn smaller, down to 8px, so it fits inside the card. The title is not touched: its words stay on the same line and are never indented, so the text keeps its full width. An icon is never hidden, and a card too narrow even for the smallest icon is left to clip. A post\u2019s own title is not a card, so it keeps the page\u2019s space whichever way the switch is set.',
						'titlesparks'
					) }
				</Item>
			</Section>

			<Section
				title={ __( 'Size', 'titlesparks' ) }
				description={ __(
					'How large the icon is drawn.',
					'titlesparks'
				) }
			>
				<Item term={ __( 'Per stage', 'titlesparks' ) }>
					{ __(
						'Sidebar → Size. A later stage can be bigger or smaller than the one before it.',
						'titlesparks'
					) }
				</Item>
				<Item
					term={ __(
						'Empty means the asset\u2019s size',
						'titlesparks'
					) }
				>
					{ __(
						'Leave Size blank to use the size set on the asset itself, shown beside the field. Typing a number overrides it for that stage only.',
						'titlesparks'
					) }
				</Item>
				<Item term={ __( 'Units', 'titlesparks' ) }>
					{ sprintf(
						/* translators: %s: the default icon size, e.g. 20px. */
						__(
							'px, em, rem or %%. The default is %s. em sizes scale with the title, which keeps the icon in proportion as the heading grows.',
							'titlesparks'
						),
						'20px'
					) }
				</Item>
				<Item
					term={ __(
						'Following the title\u2019s size',
						'titlesparks'
					) }
				>
					{ __(
						'On a stage, choose Advanced (custom sizes) and the icon is sized from a table of title sizes and icon sizes, which appears only once you choose it: each row sets the icon size for titles from that title size up to the next row, so rows of 32 → 32 and 40 → 45 draw a 32px icon beside every title from 32px to 39px and a 45px one from 40px up. A title smaller than every row uses the first row\u2019s icon, a larger one uses the last. The table starts from a copy of the site\u2019s numbers under Settings → Title size → icon size, and editing one gives this stage its own table. A stage set to a fixed size keeps its own size instead.',
						'titlesparks'
					) }
				</Item>
				<Item term={ __( 'Resizing keeps its place', 'titlesparks' ) }>
					{ __(
						'The icon stays centred on the title\u2019s line and keeps its own space, so a size change never draws it over the words. Up to 20px it grows and shrinks about its middle; larger icons grow away from the title. It looks the same in the editor, in this sidebar\u2019s preview, on your site and in widget titles such as the Posts Slider.',
						'titlesparks'
					) }
				</Item>
			</Section>

			<Section
				title={ __( 'Assets', 'titlesparks' ) }
				description={ __(
					'GIFs, icons and images shared by every post.',
					'titlesparks'
				) }
			>
				<Item term={ __( 'Add assets', 'titlesparks' ) }>
					{ __(
						'The Asset Library tab uploads through the WordPress media library, so files live where your other images do.',
						'titlesparks'
					) }
				</Item>
				<Item term={ __( 'Where to find GIFs', 'titlesparks' ) }>
					{ __(
						'Free icons and animated GIFs can be found on Pixabay (https://pixabay.com/). Download one there, then upload it here.',
						'titlesparks'
					) }
				</Item>
				<Item term={ __( 'Label', 'titlesparks' ) }>
					{ __(
						'Names the asset in the picker and is read out as the icon\u2019s alt text.',
						'titlesparks'
					) }
				</Item>
				<Item term={ __( 'Removing one', 'titlesparks' ) }>
					{ __(
						'A stage whose asset is gone shows no icon until you pick another.',
						'titlesparks'
					) }
				</Item>
			</Section>

			<Section
				title={ __( 'Defaults', 'titlesparks' ) }
				description={ __(
					'What a new post starts from.',
					'titlesparks'
				) }
			>
				<Item term={ __( 'Set on the Settings tab', 'titlesparks' ) }>
					{ __(
						'Position, durations and the final action are copied into a new post. Every value stays editable in the editor.',
						'titlesparks'
					) }
				</Item>
				<Item term={ __( 'Entered as end dates', 'titlesparks' ) }>
					{ __(
						'The defaults use the same calendar and time picker the editor does, and are saved as lengths, because a post that does not exist yet has no date of its own to count from.',
						'titlesparks'
					) }
				</Item>
				<Item term={ __( 'Post types', 'titlesparks' ) }>
					{ __(
						'Titles only get icons on the post types you tick.',
						'titlesparks'
					) }
				</Item>
			</Section>
		</div>

		{ settingsUrl && (
			<a
				href={ settingsUrl }
				className="titlesparks:inline-flex titlesparks:items-center titlesparks:gap-1.5 titlesparks:self-start titlesparks:rounded-lg titlesparks:bg-brand-50 titlesparks:px-3 titlesparks:py-2 titlesparks:text-xs titlesparks:font-medium titlesparks:text-brand-900 titlesparks:transition-colors titlesparks:hover:bg-brand-100"
			>
				{ __( 'Back to settings', 'titlesparks' ) }
				<IconArrowRight className="titlesparks:h-3.5 titlesparks:w-3.5" />
			</a>
		) }
	</div>
);

export default Guide;
