import type { ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { t } from "@lingui/core/macro";
import { FloppyDiskIcon } from "@phosphor-icons/react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Suspense, useCallback, useState } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { toast } from "sonner";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { ResumePreview } from "@/features/resume/preview/preview";
import { BuilderDock } from "./dock";
import { DEFAULT_BUILDER_PREVIEW_PAGE_LAYOUT, getNextBuilderPreviewPageLayout } from "./page-layout";

// Anchors the resume preview to the top-right corner of the viewport. The content width is not
// available when TransformWrapper initializes (lazy-loaded PDF pages), so fall back to a
// ResizeObserver and apply the alignment once the first non-empty size is reported.
function alignContentToTopRight(ref: ReactZoomPanPinchRef) {
	const { instance, state, setTransform } = ref;
	const { wrapperComponent, contentComponent } = instance;
	if (!wrapperComponent || !contentComponent) return;

	const applyAlignment = (): boolean => {
		if (contentComponent.offsetWidth <= 0) return false;
		const positionX = wrapperComponent.offsetWidth - contentComponent.offsetWidth * state.scale;
		setTransform(positionX, 0, state.scale, 0, "easeOut");
		return true;
	};

	if (applyAlignment()) return;

	const observer = new ResizeObserver(() => {
		if (!applyAlignment()) return;
		observer.disconnect();
	});
	observer.observe(contentComponent);
}

export function PreviewPage() {
	const [pageLayout, setPageLayout] = useState(DEFAULT_BUILDER_PREVIEW_PAGE_LAYOUT);

	const handleTransformWrapperInit = useCallback((ref: ReactZoomPanPinchRef) => {
		alignContentToTopRight(ref);
	}, []);

	useHotkey("Mod+S", () => {
		toast.info(t`Your changes are saved automatically.`, { id: "auto-save", icon: <FloppyDiskIcon /> });
	});

	return (
		<Suspense fallback={<LoadingScreen />}>
			<div className="fixed inset-0">
				<TransformWrapper
					maxScale={5}
					minScale={0.5}
					initialScale={2}
					limitToBounds={false}
					wheel={{ step: 0.001, disabled: true }}
					onInit={handleTransformWrapperInit}
				>
					<TransformComponent wrapperClass="h-full! w-full!" wrapperStyle={{ overflowY: "auto", overflowX: "hidden" }}>
						<ResumePreview showPageNumbers pageLayout={pageLayout} />
					</TransformComponent>

					<BuilderDock
						pageLayout={pageLayout}
						onTogglePageLayout={() => {
							setPageLayout((current) => getNextBuilderPreviewPageLayout(current));
						}}
					/>
				</TransformWrapper>
			</div>
		</Suspense>
	);
}
