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
import { centerAtActualSize } from "./preview-fit";

export function PreviewPage() {
	const [pageLayout, setPageLayout] = useState(DEFAULT_BUILDER_PREVIEW_PAGE_LAYOUT);

	const handleTransformWrapperInit = useCallback((ref: ReactZoomPanPinchRef) => {
		// The content size is not available when TransformWrapper initializes (lazy-loaded PDF pages),
		// so fall back to a ResizeObserver and center once the first non-empty size is reported.
		if (centerAtActualSize(ref)) return;

		const { contentComponent } = ref.instance;
		if (!contentComponent) return;

		const observer = new ResizeObserver(() => {
			if (!centerAtActualSize(ref)) return;
			observer.disconnect();
		});
		observer.observe(contentComponent);
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
					initialScale={1}
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
