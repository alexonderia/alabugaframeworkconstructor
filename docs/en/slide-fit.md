# Presentation fitting

## Run and apply

Open «Оформление» (Design) in the slide inspector. Under «Этот слайд» (This slide), select «Подобрать фон и размещение» (Fit background and placement). Under «Все слайды» (All slides), select «Подобрать оформление всей презентации» (Fit the entire presentation). Review the preview and apply it in one undoable operation. The library calculates sizes, grid and background.

Lock composition, background or text sizes that must remain. Background placements are full, left/right quarter, left/right third, or none. Review custom grids and manually locked values separately.

## Sizes and limitations

The canvas is 1600×900, 16:9. Heading sizes are 64/80/96/112 px; body 32/36/40; card titles 36/40/44; captions 24/28; tables 28/32; metrics 96/120/144. These are screen-layout decisions, not additional brand-book requirements.

Measurement waits for fonts and images and uses the shared renderer. If content cannot fit, the original is kept and issues are shown. The engine never shortens content, invents facts or adds slides. Split an overflowing slide manually. Geometry checks do not validate facts.

## Format and export

Schema 3 stores widget.typography and appearance.backgroundPlacement, backgroundId and fitted. Existing documents remain untouched until explicitly fitted. Measurement and application are separate; export uses saved layout without refitting.

[Framework live example and API]({{FRAMEWORK_DOCS_URL}}#compositions). [Author guide](author.md). [AI](ai.md).
