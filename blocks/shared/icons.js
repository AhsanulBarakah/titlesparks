/**
 * Inline SVG icon set.
 *
 * Hand-rolled rather than imported from `@wordpress/icons` so the bundles carry
 * no extra package and the icons inherit `currentColor` from Tailwind classes.
 * Every icon is decorative and hidden from assistive tech; the surrounding
 * control provides the accessible name.
 *
 * Drawn as strokes on a 24-unit grid rather than as filled shapes, which is what
 * makes the set read as one family at any size: nothing carries its own weight,
 * so a 16px icon in a tab and a 20px one in a sidebar header have the same edge.
 * The stroke is `currentColor`, so a tab's icon takes the tab's text colour and
 * an active row's icon darkens with it — no per-icon colour to keep in sync.
 *
 * The grid is 24 wide because that is the one every stroke set is drawn on: the
 * art has the room a 20-unit grid does not, and the size on screen still comes
 * from the class (`titlesparks:h-4 titlesparks:w-4` by default), never from the `viewBox`.
 */

/**
 * Base props shared by every icon.
 *
 * @param {Object} props
 * @param {string} [props.className]   Extra classes.
 * @param {number} [props.strokeWidth] Overrides the shared hairline weight, for
 *                                     icons drawn small enough to need it (the
 *                                     checkbox tick is the one that does).
 * @return {Object} Spreadable SVG props.
 */
const base = ( {
	className = 'titlesparks:h-4 titlesparks:w-4',
	strokeWidth = 1.6,
	...rest
} ) => ( {
	className,
	viewBox: '0 0 24 24',
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth,
	strokeLinecap: 'round',
	strokeLinejoin: 'round',
	'aria-hidden': 'true',
	focusable: 'false',
	...rest,
} );

export const IconMegaphone = ( props ) => (
	<svg { ...base( props ) }>
		<path d="m3 11 18-5v12L3 14v-3Z" />
		<path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
	</svg>
);

const TITLESPARKS_ICON_SRC =
	'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjI0NS4yNSA5NS4yNSAxMDkuNSAxMDkuNSIgd2lkdGg9IjIyIiBoZWlnaHQ9IjIyIiBzaGFwZS1yZW5kZXJpbmc9Imdlb21ldHJpY1ByZWNpc2lvbiI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJhIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIi8+PHN0b3Agb2Zmc2V0PSI1MCUiLz48c3RvcCBvZmZzZXQ9IjEwMCUiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgzMDAgMTUwKSI+PGNpcmNsZSByPSI1NCIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjIuNSIvPjxjaXJjbGUgcj0iNDQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLWRhc2hhcnJheT0iNCA4Ii8+PHBhdGggZD0iTTAtNDJxMzggMTYgMzggNTgtMzggMzItNzYgMCAwLTQyIDM4LTU4WiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ1cmwoI2EpIiBzdHJva2Utd2lkdGg9IjMuNSIvPjxjaXJjbGUgY3g9IjI4IiBjeT0iLTI5IiByPSI0Ii8+PGNpcmNsZSByPSI3IiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41Ii8+PHBhdGggZD0iTTE0LTIwYzEgNSAyIDYgNyA3LTUgMS02IDItNyA3LTEtNS0yLTYtNy03IDUtMSA2LTIgNy03TS0xNCA4YzEgNCAyIDUgNiA2LTQgMS01IDItNiA2LTEtNC0yLTUtNi02IDQtMSA1LTIgNi02Ii8+PGNpcmNsZSBjeD0iLTI1IiBjeT0iMjAiIHI9IjIuNSIvPjxjaXJjbGUgY3g9IjI1IiBjeT0iLTgiIHI9IjIuNSIvPjxjaXJjbGUgY3g9Ii0zNSIgY3k9Ii0zNSIgcj0iMy4yIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iLjciLz48Y2lyY2xlIGN4PSIzNSIgY3k9IjM0IiByPSI0IiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iLjciLz48Y2lyY2xlIGN4PSIxMCIgY3k9Ii00OCIgcj0iNC4yIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iLjgiLz48Y2lyY2xlIGN4PSItMjUiIGN5PSI0MyIgcj0iMy40IiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iLjciLz48Y2lyY2xlIGN4PSItNDYiIGN5PSIxMiIgcj0iNC44IiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iLjgiLz48Y2lyY2xlIGN4PSI0NSIgY3k9Ii0yMCIgcj0iMyIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9Ii43Ii8+PC9nPjwvc3ZnPg==';

export const IconTitlesparks = ( props ) => {
	const {
		className = 'titlesparks:h-5 titlesparks:w-5',
		src = TITLESPARKS_ICON_SRC,
		...rest
	} = props;

	return (
		<img
			className={ className }
			src={ src }
			alt=""
			aria-hidden="true"
			{ ...rest }
		/>
	);
};

/**
 * Edit: a page with a pen over its corner.
 *
 * The page is what makes it read as "edit this thing" rather than "draw", which
 * a bare pencil does — the two sit side by side on a library card, where there
 * is no other furniture to say what is being edited.
 *
 * @param {Object} props
 */
export const IconPencil = ( props ) => (
	<svg { ...base( props ) }>
		<path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
		<path d="M18.6 2.6a2.1 2.1 0 0 1 2.8 2.8L12 15l-4 1 1-4 9.6-9.4Z" />
	</svg>
);

/**
 * Delete: a lidded bin with two uprights.
 *
 * Drawn with a straight lid and a rounded body rather than a tapered one, so it
 * reads as the same weight as the pen beside it and not as an outline that was
 * traced from a smaller size.
 *
 * @param {Object} props
 */
export const IconTrash = ( props ) => (
	<svg { ...base( props ) }>
		<path d="M3 6h18" />
		<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
		<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
		<path d="M10 11v6M14 11v6" />
	</svg>
);

export const IconPlus = ( props ) => (
	<svg { ...base( props ) }>
		<path d="M12 5v14M5 12h14" />
	</svg>
);

export const IconFolder = ( props ) => (
	<svg { ...base( props ) }>
		<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10Z" />
		<path d="M3.5 9h17" />
	</svg>
);

export const IconSearch = ( props ) => (
	<svg { ...base( props ) }>
		<circle cx="11" cy="11" r="7" />
		<path d="m20 20-3.6-3.6" />
	</svg>
);

export const IconClose = ( props ) => (
	<svg { ...base( props ) }>
		<path d="M6 6l12 12M18 6L6 18" />
	</svg>
);

export const IconInfo = ( props ) => (
	<svg { ...base( props ) }>
		<circle cx="12" cy="12" r="9" />
		<path d="M12 16v-5M12 8h.01" />
	</svg>
);

/**
 * A tick, at the weight a checkbox needs.
 *
 * Drawn heavier than the rest of the set on purpose: inside an 18px box this
 * lands at roughly 1.8px of ink, and a hairline tick in a filled square is the
 * one place a 1.6 stroke reads as a rendering artefact rather than a line.
 *
 * @param {Object} props
 */
export const IconCheck = ( props ) => (
	<svg { ...base( { strokeWidth: 2.5, ...props } ) }>
		<path d="m5 12.5 4.5 4.5L19 7" />
	</svg>
);

export const IconHelp = ( props ) => (
	<svg { ...base( props ) }>
		<circle cx="12" cy="12" r="9" />
		<path d="M9.4 9a2.7 2.7 0 0 1 5.3.8c0 1.8-2.7 2.7-2.7 2.7" />
		<path d="M12 17h.01" />
	</svg>
);

/**
 * Settings: three tracks, each with its own handle.
 *
 * The three rows are what make it read as "settings" at 16px rather than as
 * generic controls, and the handles are full-height so they still resolve as
 * grips when the icon is drawn at the size a tab uses.
 *
 * @param {Object} props
 */
export const IconSliders = ( props ) => (
	<svg { ...base( props ) }>
		<path d="M4 7h4M12 7h8M4 12h10M18 12h2M4 17h2M10 17h10" />
		<path d="M10 4.5v5M16 9.5v5M8 14.5v5" />
	</svg>
);

export const IconChevron = ( props ) => (
	<svg { ...base( props ) }>
		<path d="m6 9 6 6 6-6" />
	</svg>
);

export const IconArrowRight = ( props ) => (
	<svg { ...base( props ) }>
		<path d="M5 12h14" />
		<path d="m13 6 6 6-6 6" />
	</svg>
);

export const IconImage = ( props ) => (
	<svg { ...base( props ) }>
		<rect x="3" y="4" width="18" height="16" rx="2.5" />
		<circle cx="8.5" cy="9.5" r="1.5" />
		<path d="m4 17 5-5 4.5 4.5L17 13l3.5 3.5" />
	</svg>
);
