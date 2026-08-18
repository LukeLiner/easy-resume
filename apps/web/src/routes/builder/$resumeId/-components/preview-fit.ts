import type { ReactZoomPanPinchRef } from "react-zoom-pan-pinch";

// Fraction of the artboard the resume may occupy when fitting to view, leaving a small margin.
const FIT_PADDING = 0.9;

type ArtboardBounds = {
	left: number;
	top: number;
	width: number;
	height: number;
};

// The preview is rendered in a `fixed inset-0` wrapper that spans the full viewport, but the resume
// should sit inside the artboard (`#main-content`) — the remaining visible page to the right of the
// sidebar and below the header.
function getArtboardBounds(): ArtboardBounds {
	const artboard = document.getElementById("main-content")?.getBoundingClientRect();
	if (!artboard || artboard.width <= 0 || artboard.height <= 0) {
		return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
	}
	return { left: artboard.left, top: artboard.top, width: artboard.width, height: artboard.height };
}

// Positions the resume (scaled to `scale`) aligned to the top-left corner of the artboard, so the
// resume starts exactly where the combined sidebar ends. Returns `false` while the content has no
// measurable size (lazy-loaded PDF pages) so callers can retry via a ResizeObserver.
function alignContentToStart(ref: ReactZoomPanPinchRef, scale: number, animationTime: number): boolean {
	const { instance, setTransform } = ref;
	const { contentComponent } = instance;
	if (!contentComponent || contentComponent.offsetWidth <= 0) return false;

	const bounds = getArtboardBounds();
	setTransform(bounds.left, bounds.top, scale, animationTime, "easeOut");
	return true;
}

// Aligns the resume to the top-left corner of the artboard at 100% zoom.
export function alignToStart(ref: ReactZoomPanPinchRef, animationTime = 0): boolean {
	return alignContentToStart(ref, 1, animationTime);
}

// Zooms the resume to the given scale and aligns it to the top-left corner of the artboard.
export function zoomToStart(ref: ReactZoomPanPinchRef, scale: number, animationTime = 0): boolean {
	return alignContentToStart(ref, scale, animationTime);
}

// Fits the resume to fill the artboard (the remaining visible page) and aligns it to the top-left corner.
export function fitToStart(ref: ReactZoomPanPinchRef): boolean {
	const { instance } = ref;
	const { contentComponent } = instance;
	if (!contentComponent || contentComponent.offsetWidth <= 0) return false;

	const bounds = getArtboardBounds();
	const scale =
		Math.min(bounds.width / contentComponent.offsetWidth, bounds.height / contentComponent.offsetHeight) * FIT_PADDING;
	return alignContentToStart(ref, scale, 200);
}
