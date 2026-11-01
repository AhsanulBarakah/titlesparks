/**
 * Small Tailwind UI kit.
 *
 * Hand-built instead of `@wordpress/components` so the design is reproduced
 * exactly, while staying accessible: native `<button>`, `<select>` and
 * `<input>` elements keep keyboard, screen reader and form semantics.
 *
 * The look is flat: a hairline, a tinted fill or a solid one, and nothing else.
 * No drop shadow sits under a surface or a control, and no gradient is used for
 * one — depth is spent on two things only, the focus outline, which has to be
 * unmistakable for keyboard use, and the dialog, which floats above a scrim.
 *
 * Radii are a scale rather than a default: controls and their pills take 8px,
 * surfaces and the tab track take 12px, and only the switch and the badge are
 * fully round, because those read as markers rather than as panels. A solid
 * button carries no border — its fill is its edge — which is what makes it sit
 * flat against the page instead of being outlined on it.
 *
 * Every class name is a complete literal string. Tailwind scans source text, so
 * never build a class by concatenation — a composed name would not be generated
 * and would silently render unstyled.
 */

import { useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

import { MAX_ASSET_TAGS } from './constants';
import { IconCheck, IconClose, IconPlus } from './icons';

/**
 * Join class names, dropping falsy values.
 *
 * @param {...(string|false|null|undefined)} values Classes.
 * @return {string} The classes, space separated.
 */
export const cx = ( ...values ) => values.filter( Boolean ).join( ' ' );

/**
 * Shared control chrome.
 *
 * The height is stated rather than left to padding and content, because the
 * browser decides a `datetime-local` is taller than a text field at the same
 * font size. Standard controls land on 40px, while compact selects opt into a
 * 32px variant for dense editor panels.
 */
const CONTROL =
	'titlesparks:w-full titlesparks:border titlesparks:border-gray-300 titlesparks:bg-white titlesparks:text-gray-800 titlesparks:transition-colors titlesparks:placeholder:text-gray-400 titlesparks:hover:border-gray-400 titlesparks:focus:border-brand-500 titlesparks:focus:outline titlesparks:focus:outline-2 titlesparks:focus:outline-brand-500 titlesparks:disabled:bg-gray-50 titlesparks:disabled:text-gray-400';
const STANDARD_CONTROL_SIZE =
	'titlesparks:h-10 titlesparks:rounded-lg titlesparks:px-3 titlesparks:py-2 titlesparks:text-sm';
const COMPACT_CONTROL =
	'titlesparks:h-8 titlesparks:rounded-md titlesparks:px-2.5 titlesparks:py-1 titlesparks:text-xs';

const BUTTON_VARIANTS = {
	primary:
		'titlesparks:bg-brand-900 titlesparks:text-white titlesparks:hover:bg-brand-800 titlesparks:active:bg-brand-700',
	secondary:
		'titlesparks:bg-brand-50 titlesparks:text-brand-800 titlesparks:hover:bg-brand-100 titlesparks:hover:text-brand-900 titlesparks:active:bg-brand-200',
	ghost: 'titlesparks:bg-transparent titlesparks:text-gray-600 titlesparks:hover:bg-brand-50 titlesparks:hover:text-brand-900 titlesparks:active:bg-brand-100',
	danger: 'titlesparks:bg-red-50 titlesparks:text-red-700 titlesparks:hover:bg-red-100 titlesparks:active:bg-red-200',
	dangerSolid:
		'titlesparks:bg-red-600 titlesparks:text-white titlesparks:hover:bg-red-500 titlesparks:active:bg-red-700',
	link: 'titlesparks:bg-transparent titlesparks:px-0 titlesparks:text-brand-900 titlesparks:hover:text-brand-900 titlesparks:hover:underline',
};

const BUTTON_SIZES = {
	sm: 'titlesparks:px-3 titlesparks:py-1.5 titlesparks:text-xs',
	md: 'titlesparks:px-4 titlesparks:py-2 titlesparks:text-sm',
};

const BUTTON_BASE =
	'titlesparks:inline-flex titlesparks:items-center titlesparks:justify-center titlesparks:gap-1.5 titlesparks:rounded-lg titlesparks:font-medium titlesparks:leading-4 titlesparks:transition-colors titlesparks:focus:outline titlesparks:focus:outline-2 titlesparks:focus:outline-brand-400 titlesparks:disabled:cursor-not-allowed titlesparks:disabled:opacity-50';

/**
 * Button.
 *
 * @param {Object}      props
 * @param {string}      [props.variant]   primary|secondary|ghost|danger|link
 * @param {string}      [props.size]      sm|md
 * @param {string}      [props.className]
 * @param {JSX.Element} props.children
 * @param {string}      [props.type]      Button type, `button` unless a form needs `submit`.
 * @return {JSX.Element} The button.
 */
export const Button = ( {
	variant = 'secondary',
	size = 'md',
	className,
	type = 'button',
	children,
	...rest
} ) => (
	<button
		type={ type }
		className={ cx(
			BUTTON_BASE,
			BUTTON_VARIANTS[ variant ] || BUTTON_VARIANTS.secondary,
			BUTTON_SIZES[ size ] || BUTTON_SIZES.md,
			className
		) }
		{ ...rest }
	>
		{ children }
	</button>
);

/**
 * Square icon-only button.
 *
 * @param {Object}      props
 * @param {string}      props.label       Accessible name (also the tooltip).
 * @param {string}      [props.variant]
 * @param {string}      [props.className]
 * @param {JSX.Element} props.children
 * @return {JSX.Element} The square button.
 */
export const IconButton = ( {
	label,
	variant = 'ghost',
	className,
	children,
	...rest
} ) => (
	<button
		type="button"
		aria-label={ label }
		title={ label }
		className={ cx(
			BUTTON_BASE,
			BUTTON_VARIANTS[ variant ] || BUTTON_VARIANTS.ghost,
			'titlesparks:h-8 titlesparks:w-8 titlesparks:p-0',
			className
		) }
		{ ...rest }
	>
		{ children }
	</button>
);

/**
 * Labelled form field wrapper.
 *
 * @param {Object}      props
 * @param {string}      [props.label]
 * @param {string}      [props.htmlFor]
 * @param {string}      [props.hint]    One line of help, always visible.
 * @param {string}      [props.title]   Help that shows on hover instead. Used for
 *                                      a sentence that would otherwise cost a
 *                                      whole line under every field.
 * @param {JSX.Element} [props.action]  A control belonging to the field, drawn at
 *                                      the end of the label's own line. Anything
 *                                      that appears and disappears — a Reset
 *                                      that shows up once a value is not the
 *                                      default — belongs here rather than beside
 *                                      the inputs, where arriving would shrink
 *                                      the very fields the author is typing into.
 * @param {JSX.Element} props.children
 * @return {JSX.Element} The label, action, control and hint as one block.
 */
export const Field = ( { label, htmlFor, hint, title, action, children } ) => (
	<div
		className="titlesparks:flex titlesparks:flex-col titlesparks:gap-1"
		title={ title }
	>
		{ ( label || action ) && (
			<div className="titlesparks:flex titlesparks:items-center titlesparks:justify-between titlesparks:gap-2">
				{ label && (
					<label
						htmlFor={ htmlFor }
						className="titlesparks:text-xs titlesparks:font-medium titlesparks:text-gray-600"
					>
						{ label }
					</label>
				) }
				{ action }
			</div>
		) }
		{ children }
		{ hint && (
			<p className="titlesparks:m-0 titlesparks:text-xs titlesparks:text-gray-500">
				{ hint }
			</p>
		) }
	</div>
);

/**
 * Native select styled with Tailwind.
 *
 * @param {Object}   props
 * @param {string}   [props.id]
 * @param {string}   props.value
 * @param {Function} props.onChange    Receives the new value.
 * @param {Array}    props.options     `{ label, value, disabled? }` list.
 * @param {boolean}  [props.disabled]
 * @param {string}   [props.size]      `compact` for dense controls.
 * @param {string}   [props.className] Extra classes.
 * @param {string}   [props.width]     `full` (default) or `auto` intrinsic width.
 * @param {Object}   [props.rest]      Passed to the element.
 * @param {Object}   [props.style]     Extra inline style for the element.
 * @return {JSX.Element} The select.
 */
export const Select = ( {
	id,
	value,
	onChange,
	options = [],
	disabled,
	size = 'md',
	className,
	style: customStyle,
	width = 'full',
	...rest
} ) => (
	<select
		id={ id }
		value={ value }
		disabled={ disabled }
		onChange={ ( event ) => onChange( event.target.value ) }
		/* Everything else reaches the element, which is how a select that sits
		   beside a label gets its own accessible name (`aria-label`). */
		{ ...rest }
		className={ cx(
			CONTROL.replace( 'titlesparks:w-full', 'titlesparks:w-auto' ),
			'full' === width && 'titlesparks:w-full',
			'compact' === size
				? `${ COMPACT_CONTROL } titlesparks:cursor-pointer titlesparks:appearance-none titlesparks:bg-no-repeat titlesparks:pr-8`
				: `${ STANDARD_CONTROL_SIZE } titlesparks:cursor-pointer titlesparks:appearance-none titlesparks:bg-no-repeat titlesparks:pr-8`,
			className
		) }
		style={ {
			...customStyle,
			width:
				'auto' === width
					? 'fit-content'
					: ( customStyle && customStyle.width ) || '100%',
			maxWidth: 'auto' === width ? '100%' : undefined,
			boxSizing: 'border-box',
			backgroundImage:
				/* The same chevron the icon set draws by hand (`IconChevron`), as a
				   data URI: a select cannot hold a child element, so its arrow is a
				   background image and cannot live in blocks/shared/icons.js. */
				"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
			backgroundPosition: 'right 0.5rem center',
			backgroundSize: '1rem 1rem',
		} }
	>
		{ options.map( ( option ) => (
			<option
				key={ option.value }
				value={ option.value }
				disabled={ option.disabled }
			>
				{ option.label }
			</option>
		) ) }
	</select>
);

/**
 * Text input.
 *
 * @param {Object} props
 * @param {string} [props.className] Extra classes.
 * @return {JSX.Element} The input.
 */
export const TextInput = ( { className, ...rest } ) => (
	<input
		type="text"
		className={ cx( CONTROL, STANDARD_CONTROL_SIZE, className ) }
		{ ...rest }
	/>
);

/**
 * Number input, sized for short values.
 *
 * @param {Object} props
 * @param {string} [props.className] Extra classes.
 * @return {JSX.Element} The input.
 */
export const NumberInput = ( { className, ...rest } ) => (
	<input
		type="number"
		className={ cx( CONTROL, STANDARD_CONTROL_SIZE, className ) }
		{ ...rest }
	/>
);

/**
 * Date and time picker.
 *
 * Only the fields are shown — no timezone — because the value is read as a
 * wall clock moment on the site's clock rather than one on the visitor's. What
 * the author picks here is the moment the front end decays against, wherever
 * the visitor is reading from.
 *
 * @param {Object} props
 * @param {string} [props.className] Extra classes.
 * @return {JSX.Element} The fields.
 */
export const DateTimeInput = ( { className, ...rest } ) => (
	<input
		type="datetime-local"
		className={ cx( CONTROL, STANDARD_CONTROL_SIZE, className ) }
		{ ...rest }
	/>
);

/**
 * Tab strip.
 *
 * @param {Object}   props
 * @param {Array}    props.tabs        `{ label, value, icon? }` list.
 * @param {string}   props.active      Active value.
 * @param {Function} props.onChange    Receives the new value.
 * @param {string}   [props.className]
 * @return {JSX.Element} The tab strip.
 */
export const Tabs = ( { tabs, active, onChange, className } ) => (
	<div
		role="tablist"
		className={ cx(
			'titlesparks:inline-flex titlesparks:flex-wrap titlesparks:items-center titlesparks:gap-1 titlesparks:rounded-xl titlesparks:bg-brand-50 titlesparks:p-1',
			className
		) }
	>
		{ tabs.map( ( tab ) => {
			const selected = active === tab.value;
			const Icon = tab.icon;

			return (
				<button
					key={ tab.value }
					type="button"
					role="tab"
					aria-selected={ selected }
					onClick={ () => onChange( tab.value ) }
					className={ cx(
						/* A raised white pill on a grey track: the active section is the one
						   thing in the bar that has to be obvious down a long settings page,
						   and the shadow is what lifts it off the track. `titlesparks:shadow-sm` is one
						   of the few shadow utilities that survives the missing base layer;
						   see blocks/shared/tailwind.css. */
						'titlesparks:inline-flex titlesparks:items-center titlesparks:gap-2 titlesparks:rounded-lg titlesparks:px-3.5 titlesparks:py-2 titlesparks:text-sm titlesparks:transition-colors titlesparks:focus:outline titlesparks:focus:outline-2 titlesparks:focus:outline-brand-700',
						selected
							? 'titlesparks:bg-white titlesparks:font-semibold titlesparks:text-brand-900 titlesparks:shadow-xs'
							: 'titlesparks:font-medium titlesparks:text-gray-600 titlesparks:hover:bg-brand-100 titlesparks:hover:text-brand-900'
					) }
				>
					{ Icon && (
						<Icon className="titlesparks:h-4 titlesparks:w-4" />
					) }
					{ tab.label }
				</button>
			);
		} ) }
	</div>
);

/**
 * Numbered page buttons for a list longer than one page.
 *
 * Numbers rather than "previous / next": a library is browsed by jumping to a
 * page someone remembers, and an arrow pair makes that a sequence of clicks.
 * Renders nothing at all for a single page, so a short library has no footer to
 * explain away.
 *
 * @param {Object}   props
 * @param {number}   props.page        Current page, 1-based.
 * @param {number}   props.pageCount   Total pages.
 * @param {Function} props.onChange    Receives the page to show.
 * @param {string}   [props.className]
 * @return {JSX.Element|null} The page buttons, or null for a single page.
 */
export const Pagination = ( { page, pageCount, onChange, className } ) => {
	if ( pageCount < 2 ) {
		return null;
	}

	return (
		<nav
			aria-label={ __( 'Library pages', 'titlesparks' ) }
			className={ cx(
				'titlesparks:flex titlesparks:flex-wrap titlesparks:items-center titlesparks:gap-1',
				className
			) }
		>
			{ Array.from(
				{ length: pageCount },
				( value, index ) => index + 1
			).map( ( number ) => {
				const current = number === page;

				return (
					<button
						key={ number }
						type="button"
						aria-current={ current ? 'page' : undefined }
						onClick={ () => onChange( number ) }
						className={ cx(
							'titlesparks:inline-flex titlesparks:h-8 titlesparks:min-w-8 titlesparks:items-center titlesparks:justify-center titlesparks:rounded-lg titlesparks:px-2 titlesparks:text-xs titlesparks:font-medium titlesparks:transition-colors titlesparks:focus:outline titlesparks:focus:outline-2 titlesparks:focus:outline-brand-500',
							current
								? 'titlesparks:bg-brand-900 titlesparks:text-white'
								: 'titlesparks:border titlesparks:border-gray-200 titlesparks:bg-white titlesparks:text-gray-600 titlesparks:hover:border-gray-300 titlesparks:hover:text-gray-900'
						) }
					>
						{ number }
					</button>
				);
			} ) }
		</nav>
	);
};

const BADGE_TONES = {
	gray: 'titlesparks:bg-gray-100 titlesparks:text-gray-600',
	primary: 'titlesparks:bg-brand-900 titlesparks:text-white',
	brand: 'titlesparks:bg-brand-100 titlesparks:text-brand-800',
	blue: 'titlesparks:bg-brand-50 titlesparks:text-brand-800',
	green: 'titlesparks:bg-brand-50 titlesparks:text-brand-800',
	red: 'titlesparks:bg-red-50 titlesparks:text-red-700',
};

/**
 * Small pill label.
 *
 * @param {Object}      props
 * @param {string}      [props.tone]
 * @param {string}      [props.className] Extra classes, for a badge that has to
 *                                        carry its own weight in a row (the
 *                                        version chip wears the monospace face).
 * @param {JSX.Element} props.children
 * @return {JSX.Element} The pill.
 */
export const Badge = ( { tone = 'gray', className, children } ) => (
	<span
		className={ cx(
			'titlesparks:inline-flex titlesparks:items-center titlesparks:gap-1 titlesparks:rounded-full titlesparks:px-2 titlesparks:py-0.5 titlesparks:text-xs titlesparks:font-medium',
			BADGE_TONES[ tone ] || BADGE_TONES.gray,
			className
		) }
	>
		{ children }
	</span>
);

/**
 * Accessible on/off switch.
 *
 * @param {Object}   props
 * @param {boolean}  props.checked
 * @param {Function} props.onChange    Receives the next boolean.
 * @param {string}   [props.id]
 * @param {string}   [props.className]
 * @return {JSX.Element} The switch.
 */
export const Switch = ( { checked, onChange, id, className, ...rest } ) => (
	<button
		id={ id }
		type="button"
		role="switch"
		aria-checked={ checked }
		{ ...rest }
		onClick={ () => onChange( ! checked ) }
		className={ cx(
			'titlesparks:relative titlesparks:inline-flex titlesparks:h-5 titlesparks:w-9 titlesparks:shrink-0 titlesparks:items-center titlesparks:rounded-full titlesparks:transition-colors titlesparks:focus:outline titlesparks:focus:outline-2 titlesparks:focus:outline-brand-400',
			checked ? 'titlesparks:bg-brand-700' : 'titlesparks:bg-gray-300',
			className
		) }
	>
		{ /* Positioned with `left` rather than a transform: transform utilities
		     need the `--tw-translate-*` defaults that the disabled base layer
		     would provide. See blocks/shared/tailwind.css. */ }
		<span
			className={ cx(
				'titlesparks:absolute titlesparks:top-0.5 titlesparks:h-4 titlesparks:w-4 titlesparks:rounded-full titlesparks:bg-white titlesparks:shadow-sm titlesparks:transition-all',
				checked ? 'titlesparks:left-4' : 'titlesparks:left-0.5'
			) }
		/>
	</button>
);

/**
 * Checkbox, drawn rather than left to the browser.
 *
 * The element is still a native `input[type=checkbox]`: keyboard focus, the
 * click on the label and the form semantics all come from it. What a browser
 * will not let a stylesheet finish is the box itself — Chrome keeps drawing its
 * own control — so the input is taken out of sight and its state is drawn beside
 * it, as the plugin's own square. `peer` carries the focus outline across to the
 * drawn box, which is the one thing hiding an input would otherwise cost.
 *
 * No `ring` utility on that box: the base layer declaring the `--tw-ring-*`
 * variables is deliberately not shipped (see blocks/shared/tailwind.css), so its
 * edge is a border instead.
 *
 * @param {Object}   props
 * @param {string}   props.label
 * @param {boolean}  props.checked
 * @param {Function} props.onChange      Receives the next boolean.
 * @param {string}   [props.id]
 * @param {boolean}  [props.disabled]
 * @param {string}   [props.className]
 * @param {string}   [props.description] Muted line under the label, for the
 *                                       page a switch belongs to.
 * @return {JSX.Element} The label, the hidden input and its drawn box.
 */
export const Checkbox = ( {
	label,
	checked,
	onChange,
	id,
	disabled,
	className,
	description,
} ) => (
	<label
		/* Named when the caller has an id to give, and wrapped around the input
		   either way, so clicking the label always toggles the box. */
		htmlFor={ id }
		className={ cx(
			'titlesparks:group titlesparks:inline-flex titlesparks:items-center titlesparks:gap-2 titlesparks:text-sm titlesparks:text-gray-700',
			disabled
				? 'titlesparks:cursor-not-allowed titlesparks:opacity-50'
				: 'titlesparks:cursor-pointer',
			className
		) }
	>
		<input
			id={ id }
			type="checkbox"
			checked={ checked }
			disabled={ disabled }
			onChange={ ( event ) => onChange( event.target.checked ) }
			className="titlesparks:peer titlesparks:sr-only"
		/>
		<span
			aria-hidden="true"
			className={ cx(
				'titlesparks:flex titlesparks:h-[18px] titlesparks:w-[18px] titlesparks:shrink-0 titlesparks:items-center titlesparks:justify-center titlesparks:rounded-md titlesparks:box-border titlesparks:border titlesparks:transition-colors titlesparks:peer-focus:outline titlesparks:peer-focus:outline-2 titlesparks:peer-focus:outline-brand-500',
				checked
					? 'titlesparks:border-brand-900 titlesparks:bg-brand-900 titlesparks:text-white'
					: 'titlesparks:border-gray-300 titlesparks:bg-white titlesparks:group-hover:border-brand-500'
			) }
		>
			{ checked && (
				<IconCheck className="titlesparks:h-3.5 titlesparks:w-3.5" />
			) }
		</span>
		<span className="titlesparks:flex titlesparks:flex-col">
			<span className="titlesparks:select-none">{ label }</span>
			{ description && (
				<span className="titlesparks:select-none titlesparks:text-xs titlesparks:text-gray-500">
					{ description }
				</span>
			) }
		</span>
	</label>
);

/**
 * Accessible name for a tag's remove button.
 *
 * @param {string} tag Tag text.
 * @return {string} The button's accessible name.
 */
const removeTagLabel = ( tag ) =>
	sprintf(
		/* translators: %s: tag name. */
		__( 'Remove the “%s” tag', 'titlesparks' ),
		tag
	);

/**
 * Tag editor: the tags an asset carries, plus a field to add another.
 *
 * Tags are what folders are made of, so this is the control that fills them:
 * the suggestions below the field are every tag already in use, which is what
 * keeps an author from inventing `hot news` beside an existing `news` and then
 * wondering why a folder stays empty.
 *
 * Everything here is a button or an input, never a click on a plain element, so
 * the editor works from the keyboard the way the rest of the panel does.
 *
 * @param {Object}   props
 * @param {string}   [props.id]          Ties the field to its label.
 * @param {Array}    props.tags          Tags on the asset.
 * @param {Function} props.onChange      Receives the next tag list.
 * @param {Array}    [props.suggestions] `{ tag, count }` entries already in use.
 * @return {JSX.Element} The field and its tags.
 */
export const TagField = ( { id, tags = [], onChange, suggestions = [] } ) => {
	const [ draft, setDraft ] = useState( '' );
	const full = tags.length >= MAX_ASSET_TAGS;

	/**
	 * Add whatever is in the field, if it is usable and not already there.
	 */
	const add = () => {
		const next = draft.trim();

		setDraft( '' );

		if ( ! next ) {
			return;
		}

		const lower = next.toLowerCase();

		if ( ! tags.includes( lower ) && ! full ) {
			onChange( [ ...tags, lower ] );
		}
	};

	const unused = suggestions.filter(
		( suggestion ) => ! tags.includes( suggestion.tag )
	);

	return (
		<div className="titlesparks:flex titlesparks:flex-col titlesparks:gap-2">
			{ tags.length > 0 && (
				<ul className="titlesparks:m-0 titlesparks:flex titlesparks:list-none titlesparks:flex-wrap titlesparks:gap-1.5 titlesparks:p-0">
					{ tags.map( ( tag ) => (
						<li key={ tag }>
							<span className="titlesparks:inline-flex titlesparks:items-center titlesparks:gap-1 titlesparks:rounded-full titlesparks:bg-brand-50 titlesparks:py-0.5 titlesparks:pl-2.5 titlesparks:pr-1 titlesparks:text-xs titlesparks:font-medium titlesparks:text-brand-800">
								{ tag }
								<button
									type="button"
									aria-label={ removeTagLabel( tag ) }
									onClick={ () =>
										onChange(
											tags.filter(
												( item ) => item !== tag
											)
										)
									}
									className="titlesparks:inline-flex titlesparks:h-5 titlesparks:w-5 titlesparks:items-center titlesparks:justify-center titlesparks:rounded-full titlesparks:text-brand-700 titlesparks:transition-colors titlesparks:hover:bg-brand-100 titlesparks:hover:text-brand-900"
								>
									<IconClose className="titlesparks:h-3 titlesparks:w-3" />
								</button>
							</span>
						</li>
					) ) }
				</ul>
			) }

			<div className="titlesparks:flex titlesparks:gap-2">
				<TextInput
					id={ id }
					value={ draft }
					disabled={ full }
					placeholder={ __( 'Add a tag…', 'titlesparks' ) }
					onChange={ ( event ) => setDraft( event.target.value ) }
					onKeyDown={ ( event ) => {
						if ( 'Enter' === event.key || ',' === event.key ) {
							event.preventDefault();
							add();
						}
					} }
				/>
				<Button
					variant="secondary"
					disabled={ full || ! draft.trim() }
					onClick={ add }
				>
					<IconPlus />
					{ __( 'Add', 'titlesparks' ) }
				</Button>
			</div>

			{ unused.length > 0 && ! full && (
				<div className="titlesparks:flex titlesparks:flex-wrap titlesparks:items-center titlesparks:gap-1.5">
					<span className="titlesparks:text-xs titlesparks:text-gray-500">
						{ __( 'In use:', 'titlesparks' ) }
					</span>
					{ unused.slice( 0, 12 ).map( ( suggestion ) => (
						<button
							key={ suggestion.tag }
							type="button"
							onClick={ () =>
								onChange(
									tags.includes( suggestion.tag )
										? tags
										: [ ...tags, suggestion.tag ]
								)
							}
							className="titlesparks:inline-flex titlesparks:items-center titlesparks:gap-1 titlesparks:rounded-full titlesparks:border titlesparks:border-brand-200 titlesparks:bg-brand-50 titlesparks:px-2 titlesparks:py-0.5 titlesparks:text-xs titlesparks:text-brand-900 titlesparks:transition-colors titlesparks:hover:border-brand-400 titlesparks:hover:text-brand-900"
						>
							{ suggestion.tag }
							<span className="titlesparks:text-gray-400">
								{ suggestion.count }
							</span>
						</button>
					) ) }
				</div>
			) }
		</div>
	);
};

/**
 * Spinner.
 *
 * @param {Object} props
 * @param {string} [props.className]
 * @return {JSX.Element} The spinner.
 */
export const Spinner = ( { className } ) => (
	<svg
		className={ cx(
			'titlesparks:h-4 titlesparks:w-4 titlesparks:animate-spin',
			className
		) }
		viewBox="0 0 24 24"
		fill="none"
		aria-hidden="true"
		focusable="false"
	>
		<circle
			cx="12"
			cy="12"
			r="10"
			stroke="currentColor"
			strokeWidth="4"
			className="titlesparks:opacity-25"
		/>
		<path
			fill="currentColor"
			className="titlesparks:opacity-75"
			d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z"
		/>
	</svg>
);

/**
 * White card with an optional header.
 *
 * @param {Object}      props
 * @param {string}      [props.title]
 * @param {string}      [props.description]
 * @param {JSX.Element} [props.action]
 * @param {JSX.Element} props.children
 * @param {string}      [props.className]
 * @param {string}      [props.bodyClassName] The body's own class list. It
 *                                            replaces the padding rather than
 *                                            adding to it, because two padding
 *                                            utilities on one element do not
 *                                            follow the order they are written
 *                                            in — pass `titlesparks:p-3` to tighten a
 *                                            card whose contents already space
 *                                            themselves.
 * @return {JSX.Element} The card.
 */
export const Card = ( {
	title,
	description,
	action,
	children,
	className,
	bodyClassName = 'titlesparks:p-5',
} ) => (
	<section
		className={ cx(
			'titlesparks:overflow-hidden titlesparks:rounded-xl titlesparks:border titlesparks:border-gray-200 titlesparks:bg-white',
			className
		) }
	>
		{ ( title || action ) && (
			<header className="titlesparks:flex titlesparks:items-center titlesparks:justify-between titlesparks:gap-4 titlesparks:border-b titlesparks:border-gray-100 titlesparks:px-5 titlesparks:py-4">
				<div>
					{ title && (
						<h3 className="titlesparks:m-0 titlesparks:text-sm titlesparks:font-semibold titlesparks:text-gray-900">
							{ title }
						</h3>
					) }
					{ description && (
						<p className="titlesparks:m-0 titlesparks:mt-1 titlesparks:text-xs titlesparks:text-gray-500">
							{ description }
						</p>
					) }
				</div>
				{ action }
			</header>
		) }
		<div className={ bodyClassName }>{ children }</div>
	</section>
);

const ALERT_TONES = {
	info: 'titlesparks:border-brand-200 titlesparks:bg-brand-50 titlesparks:text-brand-900',
	success:
		'titlesparks:border-brand-200 titlesparks:bg-brand-50 titlesparks:text-brand-900',
	warning:
		'titlesparks:border-amber-200 titlesparks:bg-amber-50 titlesparks:text-amber-900',
	error: 'titlesparks:border-red-200 titlesparks:bg-red-50 titlesparks:text-red-800',
};

/**
 * Inline message.
 *
 * @param {Object}      props
 * @param {string}      [props.status]    info|success|warning|error
 * @param {Function}    [props.onDismiss]
 * @param {JSX.Element} props.children
 * @return {JSX.Element} The message.
 */
export const Alert = ( { status = 'info', onDismiss, children } ) => (
	<div
		role="status"
		className={ cx(
			'titlesparks:mb-4 titlesparks:flex titlesparks:items-start titlesparks:justify-between titlesparks:gap-3 titlesparks:rounded-xl titlesparks:border titlesparks:px-4 titlesparks:py-3 titlesparks:text-sm',
			ALERT_TONES[ status ] || ALERT_TONES.info
		) }
	>
		<span>{ children }</span>
		{ onDismiss && (
			<IconButton
				label={ __( 'Dismiss', 'titlesparks' ) }
				onClick={ onDismiss }
			>
				<IconClose />
			</IconButton>
		) }
	</div>
);

const MODAL_SIZES = {
	md: 'titlesparks:max-w-lg',
	lg: 'titlesparks:max-w-2xl',
	xl: 'titlesparks:max-w-4xl',
};

/**
 * Modal dialog.
 *
 * Rendered inline with a fixed overlay rather than through a portal, so it can
 * live inside the editor sidebar without needing an extra mount node. Closes on
 * Escape and on a backdrop click.
 *
 * @param {Object}      props
 * @param {string}      props.title
 * @param {string}      [props.description]
 * @param {Function}    props.onClose
 * @param {string}      [props.size]        md|lg|xl
 * @param {JSX.Element} [props.footer]
 * @param {JSX.Element} props.children
 * @return {JSX.Element} The scrim and the dialog.
 */
export const Modal = ( {
	title,
	description,
	onClose,
	size = 'lg',
	footer,
	children,
} ) => {
	const scrim = useRef( null );

	useEffect( () => {
		const onKeyDown = ( event ) => {
			if ( 'Escape' === event.key ) {
				onClose();
			}
		};

		document.addEventListener( 'keydown', onKeyDown );

		return () => document.removeEventListener( 'keydown', onKeyDown );
	}, [ onClose ] );

	// Clicking the scrim closes the dialog, and that click is bound to the node
	// rather than written on it as `onClick`: the scrim is decoration, not a
	// control, so it takes no role a screen reader would offer to press. Every
	// keyboard user already has two ways out — Escape and the Close button — and
	// the `target` check keeps a click inside the dialog from closing it.
	useEffect( () => {
		const node = scrim.current;

		if ( ! node ) {
			return;
		}

		const onScrimClick = ( event ) => {
			if ( event.target === node ) {
				onClose();
			}
		};

		node.addEventListener( 'click', onScrimClick );

		return () => node.removeEventListener( 'click', onScrimClick );
	}, [ onClose ] );

	return (
		<div
			ref={ scrim }
			role="presentation"
			className="titlesparks:fixed titlesparks:inset-0 titlesparks:z-[100000] titlesparks:flex titlesparks:items-start titlesparks:justify-center titlesparks:overflow-y-auto titlesparks:bg-black/50 titlesparks:p-4 titlesparks:sm:p-8"
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={ title }
				className={ cx(
					'titlesparks:relative titlesparks:w-full titlesparks:rounded-xl titlesparks:bg-white titlesparks:shadow-lg',
					MODAL_SIZES[ size ] || MODAL_SIZES.lg
				) }
			>
				<header className="titlesparks:flex titlesparks:items-center titlesparks:justify-between titlesparks:gap-4 titlesparks:border-b titlesparks:border-gray-100 titlesparks:px-4 titlesparks:py-3">
					<div>
						<h2 className="titlesparks:m-0 titlesparks:text-sm titlesparks:font-semibold titlesparks:text-gray-900">
							{ title }
						</h2>
						{ description && (
							<p className="titlesparks:m-0 titlesparks:text-xs titlesparks:text-gray-500">
								{ description }
							</p>
						) }
					</div>
					<IconButton
						label={ __( 'Close', 'titlesparks' ) }
						onClick={ onClose }
					>
						<IconClose />
					</IconButton>
				</header>

				<div className="titlesparks:p-4">{ children }</div>

				{ footer && (
					<footer className="titlesparks:flex titlesparks:justify-end titlesparks:gap-2 titlesparks:border-t titlesparks:border-gray-100 titlesparks:px-4 titlesparks:py-3">
						{ footer }
					</footer>
				) }
			</div>
		</div>
	);
};
