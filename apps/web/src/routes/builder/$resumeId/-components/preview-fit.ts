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

// Positions the resume (scaled to `scale`) centered inside the artboard. Returns `false` while the
// content has no measurable size (lazy-loaded PDF pages) so callers can retry via a ResizeObserver.
function alignContentToCenter(ref: ReactZoomPanPinchRef, scale: number, animationTime: number): boolean {
	const { instance, setTransform } = ref;
	const { contentComponent } = instance;
	if (!contentComponent || contentComponent.offsetWidth <= 0) return false;

	const bounds = getArtboardBounds();
	const positionX = bounds.left + (bounds.width - contentComponent.offsetWidth * scale) / 2;
	const positionY = bounds.top + (bounds.height - contentComponent.offsetHeight * scale) / 2;
	setTransform(positionX, positionY, scale, animationTime, "easeOut");
	return true;
}

// Centers the resume at 100% zoom inside the artboard.
export function centerAtActualSize(ref: ReactZoomPanPinchRef, animationTime = 0): boolean {
	return alignContentToCenter(ref, 1, animationTime);
}

// Fits the resume to fill the artboard (the remaining visible page) and centers it.
export function fitToView(ref: ReactZoomPanPinchRef): boolean {
	const { instance } = ref;
	const { contentComponent } = instance;
	if (!contentComponent || contentComponent.offsetWidth <= 0) return false;

	const bounds = getArtboardBounds();
	const scale =
		Math.min(bounds.width / contentComponent.offsetWidth, bounds.height / contentComponent.offsetHeight) * FIT_PADDING;
	return alignContentToCenter(ref, scale, 200);
}
