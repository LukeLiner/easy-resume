export type BuilderPreviewPageLayout = "horizontal" | "vertical";

export const DEFAULT_BUILDER_PREVIEW_PAGE_LAYOUT: BuilderPreviewPageLayout = "vertical";

export const getNextBuilderPreviewPageLayout = (pageLayout: BuilderPreviewPageLayout): BuilderPreviewPageLayout =>
	pageLayout === "horizontal" ? "vertical" : "horizontal";
