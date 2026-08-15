import type { ResumeAnalysis } from "@reactive-resume/schema/resume/analysis";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { ArrowRightIcon, ChartPolarIcon, InfoIcon, SparkleIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { match } from "ts-pattern";
import { Alert, AlertDescription } from "@reactive-resume/ui/components/alert";
import { Badge } from "@reactive-resume/ui/components/badge";
import { Button } from "@reactive-resume/ui/components/button";
import { Spinner } from "@reactive-resume/ui/components/spinner";
import { useResume } from "@/features/resume/builder/draft";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";
import { SectionBase } from "../shared/section-base";

function impactCircleClass(impact: "high" | "medium" | "low") {
	return match(impact)
		.with("high", () => "bg-rose-600")
		.with("medium", () => "bg-amber-600")
		.with("low", () => "bg-emerald-600")
		.exhaustive();
}

function impactLabel(impact: "high" | "medium" | "low") {
	return match(impact)
		.with("high", () =>
			t({
				comment: "Impact severity label in resume analysis suggestion card",
				message: "High",
			}),
		)
		.with("medium", () =>
			t({
				comment: "Impact severity label in resume analysis suggestion card",
				message: "Medium",
			}),
		)
		.with("low", () =>
			t({
				comment: "Impact severity label in resume analysis suggestion card",
				message: "Low",
			}),
		)
		.exhaustive();
}

function scorecardDimensionLabel(dimension: string) {
	return match(dimension)
		.with("Clarity & Specificity", () => t`Clarity & Specificity`)
		.with("Impact & Quantification", () => t`Impact & Quantification`)
		.with("ATS Compatibility", () => t`ATS Compatibility`)
		.with("Structure & Completeness", () => t`Structure & Completeness`)
		.with("Language & Relevance", () => t`Language & Relevance`)
		.otherwise(() => dimension);
}

export function ResumeAnalysisSectionBuilder() {
	const queryClient = useQueryClient();
	const { i18n } = useLingui();

	const resume = useResume();

	const resumeId = resume?.id ?? "";
	const { data: providers } = useQuery(orpc.aiProviders.list.queryOptions());
	const aiEnabled = providers?.some((provider) => provider.enabled && provider.testStatus === "success") ?? false;

	const { data: analysis, isFetched: analysisFetched } = useQuery({
		...orpc.resume.analysis.getById.queryOptions({ input: { id: resumeId } }),
		enabled: !!resume,
	});

	const { mutate: analyzeResume, isPending } = useMutation({
		...orpc.ai.analyzeResume.mutationOptions(),
		onSuccess: (analysis) => {
			queryClient.setQueryData(orpc.resume.analysis.getById.queryKey({ input: { id: resumeId } }), analysis);
			toast.success(t`Resume analysis complete.`);
		},
		onError: (error) => {
			const description = getOrpcErrorMessage(error, {
				byCode: {
					BAD_REQUEST: t({
						comment: "Error description when AI returns invalid resume analysis format",
						message: "The AI returned an invalid analysis format. Please try again.",
					}),
					BAD_GATEWAY: t({
						comment: "Error description when AI provider cannot be reached during resume analysis",
						message: "Could not reach the AI provider. Please try again.",
					}),
					PRECONDITION_FAILED: t({
						comment: "Error description when user has exceeded their resume analysis quota",
						message: "You have exceeded your resume analysis quota.",
					}),
				},
				fallback: t({
					comment: "Fallback error description when resume analysis request fails",
					message: "Something went wrong while analyzing your resume.",
				}),
			});

			toast.error(t`Failed to analyze resume.`, { description });
		},
	});

	const score = analysis?.overallScore ?? null;
	const updatedAt = analysis?.updatedAt ?? null;
	// Derived during render (not via state+effect): the analysis comes from a client-fetched query,
	// so the server render has no date and there's no hydration mismatch to defer around.
	const updatedAtLabel = updatedAt ? new Date(updatedAt).toLocaleString() : null;
	const analyzeLabel = isPending ? t`Analyzing…` : t`Analyze Resume`;
	const analysisSteps = [
		t`Reading resume data`,
		t`Scoring each dimension`,
		t`Generating suggestions`,
		t`Finalizing the report`,
	];
	const [stepIndex, setStepIndex] = useState(0);

	useEffect(() => {
		if (!isPending) {
			setStepIndex(0);
			return;
		}

		const interval = window.setInterval(() => {
			setStepIndex((current) => Math.min(current + 1, analysisSteps.length - 1));
		}, 3000);

		return () => window.clearInterval(interval);
	}, [isPending, analysisSteps.length]);

	const scoreTone =
		score == null ? "bg-muted" : score >= 80 ? "bg-emerald-600" : score >= 60 ? "bg-amber-600" : "bg-rose-600";

	const onAnalyze = () => {
		if (!resume) return;

		analyzeResume({
			resumeId: resume.id,
			locale: i18n.locale,
		});
	};

	if (!resume) return null;

	return (
		<SectionBase type="analysis" className="space-y-4">
			{!aiEnabled && <DisabledState />}

			{aiEnabled && (
				<div className="space-y-3">
					<div className="space-y-4 rounded-md border bg-card p-3">
						<div className="grid grid-cols-2 items-center gap-3">
							<div>
								<p className="text-muted-foreground text-xs">
									<Trans>
										Get a review of your resume with an overall score, strengths, and actionable suggestions.
									</Trans>
								</p>
							</div>

							<div className="space-y-2">
								<Button disabled={isPending} onClick={onAnalyze} className="ml-auto w-fit">
									{isPending ? <Spinner /> : <SparkleIcon />}
									{analyzeLabel}
								</Button>

								{isPending && (
									<div className="space-y-1">
										<div className="flex items-center justify-between text-muted-foreground text-xs">
											<span>{analysisSteps[stepIndex]}</span>
											<span>{Math.round(((stepIndex + 1) / analysisSteps.length) * 100)}%</span>
										</div>
										<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
											<div
												className="h-full rounded-full bg-primary transition-all duration-500"
												style={{ width: `${((stepIndex + 1) / analysisSteps.length) * 100}%` }}
											/>
										</div>
									</div>
								)}
							</div>
						</div>

						<div className="grid grid-cols-[auto_1fr] items-center gap-3">
							<div
								className={`grid size-18 place-items-center rounded-full border-3 border-background font-bold text-lg text-white ${scoreTone}`}
							>
								{score ?? "--"}
							</div>

							<div className="space-y-3">
								<p className="font-medium text-sm leading-none">
									<Trans>Overall Score</Trans>
								</p>
								<div className="grid grid-cols-10 gap-1">
									{Array.from({ length: 10 }).map((_, index) => {
										const active = score != null && index < Math.round(score / 10);
										return (
											<div
												key={`scorebar-${index}`}
												className={`h-1.5 rounded-full transition-colors ${active ? scoreTone : "bg-muted"}`}
											/>
										);
									})}
								</div>
								{updatedAtLabel ? (
									<p className="text-muted-foreground text-xs leading-none">
										<Trans>Last analyzed on {updatedAtLabel}</Trans>
									</p>
								) : null}
							</div>
						</div>
					</div>

					{analysisFetched && !analysis && !isPending && (
						<div className="rounded-md border border-dashed p-3">
							<p className="max-w-xs text-muted-foreground text-sm">
								<Trans>Run your first analysis to get a scorecard, strengths, and prioritized suggestions.</Trans>
							</p>
						</div>
					)}

					{analysis && (
						<div className="space-y-4">
							<div className="space-y-3 rounded-md border p-3">
								<h5 className="flex items-center gap-2 font-semibold text-base">
									<ChartPolarIcon className="text-primary" />
									<Trans>Score Distribution</Trans>
								</h5>
								<ScorecardRadar items={analysis.scorecard} />
							</div>

							{analysis.strengths.length > 0 && (
								<div className="space-y-3 rounded-md border p-3">
									<h5 className="font-semibold text-base">
										<Trans>Strengths</Trans>
									</h5>

									<ul className="list-outside list-disc pl-5 text-muted-foreground text-sm">
										{analysis.strengths.map((strength) => (
											<li key={strength} className="py-1.5">
												{strength}
											</li>
										))}
									</ul>
								</div>
							)}

							{analysis.suggestions.length > 0 && (
								<div className="space-y-4 rounded-md border p-3">
									<h5 className="font-semibold text-base">
										<Trans>Suggestions</Trans>
									</h5>

									<div className="space-y-3">
										{analysis.suggestions.map((suggestion) => (
											<div key={suggestion.title} className="space-y-3 rounded-md border bg-card p-3">
												<div className="flex items-center gap-2">
													<span
														aria-hidden="true"
														className={`size-2.5 shrink-0 rounded-full ring-1 ring-border ${impactCircleClass(suggestion.impact)}`}
														title={impactLabel(suggestion.impact)}
													/>
													<span className="sr-only">{impactLabel(suggestion.impact)}</span>
													<div className="font-semibold text-base tracking-tight">{suggestion.title}</div>
												</div>

												<div className="text-muted-foreground text-xs">{suggestion.why}</div>

												{suggestion.exampleRewrite && (
													<div className="rounded bg-muted p-2 text-muted-foreground text-xs">
														{suggestion.exampleRewrite}
													</div>
												)}
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					)}
				</div>
			)}
		</SectionBase>
	);
}

type ScorecardRadarProps = {
	items: ResumeAnalysis["scorecard"];
};

function splitLabel(label: string): string[] {
	const words = label.split(" ").filter(Boolean);

	// Multi-word labels (e.g. English): wrap by words, keeping each line short.
	if (words.length > 1) {
		const maxLength = 12;
		const lines: string[] = [];
		let current = "";

		for (const word of words) {
			if (current.length > 0 && current.length + 1 + word.length > maxLength) {
				lines.push(current);
				current = word;
			} else {
				current = current.length > 0 ? `${current} ${word}` : word;
			}
		}
		if (current.length > 0) lines.push(current);

		return lines;
	}

	// Single-word labels (e.g. CJK): split by characters into at most 3 lines.
	const maxChars = 6;
	if (label.length <= maxChars) return [label];

	const lineCount = Math.min(3, Math.ceil(label.length / maxChars));
	const perLine = Math.ceil(label.length / lineCount);
	const lines: string[] = [];
	for (let i = 0; i < label.length; i += perLine) {
		lines.push(label.slice(i, i + perLine));
	}

	return lines;
}

function ScorecardRadar({ items }: ScorecardRadarProps) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const selectedItem = items[selectedIndex] ?? items[0];

	const size = 360;
	const center = size / 2;
	const radius = 100;
	const angleFor = (index: number) => -Math.PI / 2 + (index * 2 * Math.PI) / items.length;
	const pointFor = (index: number, value: number) => ({
		x: center + Math.cos(angleFor(index)) * radius * (value / 100),
		y: center + Math.sin(angleFor(index)) * radius * (value / 100),
	});
	const polygonPoints = (value: number) =>
		items
			.map((_, index) => pointFor(index, value))
			.map((point) => `${point.x},${point.y}`)
			.join(" ");
	const dataPoints = items
		.map((item, index) => pointFor(index, item.score))
		.map((point) => `${point.x},${point.y}`)
		.join(" ");

	return (
		<div className="space-y-3">
			<div className="mx-auto w-full max-w-80">
				<svg
					viewBox={`0 0 ${size} ${size}`}
					className="size-full"
					role="img"
					aria-label={t`Radar chart of resume scorecard dimensions`}
				>
					{[25, 50, 75, 100].map((level) => (
						<polygon key={level} points={polygonPoints(level)} className="fill-none stroke-border" />
					))}
					{items.map((_, index) => {
						const tip = pointFor(index, 100);
						return (
							<line key={`axis-${index}`} x1={center} y1={center} x2={tip.x} y2={tip.y} className="stroke-border" />
						);
					})}
					<polygon
						points={dataPoints}
						className="fill-amber-600/25 stroke-amber-600"
						strokeLinejoin="round"
						strokeWidth={2}
					/>
					{items.map((item, index) => {
						const point = pointFor(index, item.score);
						const active = index === selectedIndex;
						return (
							// biome-ignore lint/a11y/noStaticElementInteractions: SVG vertex dot; keyboard access via the dimension chips below
							<circle
								key={item.dimension}
								cx={point.x}
								cy={point.y}
								r={active ? 6 : 4}
								fill="var(--color-primary)"
								fillOpacity={active ? 1 : 0.5}
								className="cursor-pointer stroke-background"
								strokeWidth={2}
								onClick={() => setSelectedIndex(index)}
							/>
						);
					})}
					{items.map((item, index) => {
						const tip = pointFor(index, 100);
						const angle = angleFor(index);
						const cos = Math.cos(angle);
						const sin = Math.sin(angle);
						const anchor = cos > 0.35 ? "start" : cos < -0.35 ? "end" : "middle";
						const dx = cos > 0.35 ? 8 : cos < -0.35 ? -8 : 0;
						const lines = splitLabel(scorecardDimensionLabel(item.dimension));
						const lineHeight = 16;
						const dy =
							sin <= -0.5 ? -(lines.length - 1) * lineHeight - 4 : sin >= 0.5 ? lineHeight + 4 : 4;
						return (
							<text
								key={`label-${item.dimension}`}
								x={tip.x + dx}
								y={tip.y + dy}
								textAnchor={anchor}
								className="fill-muted-foreground font-medium text-base"
							>
								{lines.map((line, lineIndex) => (
									<tspan key={line} x={tip.x + dx} dy={lineIndex === 0 ? 0 : lineHeight}>
										{line}
									</tspan>
								))}
							</text>
						);
					})}
				</svg>
			</div>

			<div className="flex flex-wrap gap-1.5">
				{items.map((item, index) => (
					<button
						key={item.dimension}
						type="button"
						onClick={() => setSelectedIndex(index)}
						className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium text-xs transition-colors ${
							index === selectedIndex
								? "border-primary bg-primary text-primary-foreground"
								: "border-border bg-card text-muted-foreground hover:bg-muted"
						}`}
					>
						<span
							aria-hidden="true"
							className={`size-1.5 rounded-full ${index === selectedIndex ? "bg-primary-foreground" : "bg-primary"}`}
						/>
						{scorecardDimensionLabel(item.dimension)}
					</button>
				))}
			</div>

			<div className="space-y-3 rounded-md border bg-card p-3">
				<div className="flex items-center justify-between gap-2">
					<div className="font-medium text-sm">{scorecardDimensionLabel(selectedItem.dimension)}</div>
					<Badge variant="default" className="font-bold">{selectedItem.score}/100</Badge>
				</div>
				<p className="text-muted-foreground text-xs">{selectedItem.rationale}</p>
			</div>
		</div>
	);
}

function DisabledState() {
	return (
		<Alert>
			<InfoIcon />
			<AlertDescription className="space-y-3">
				<p>
					<Trans>
						Get an in-depth AI-powered review of your resume with an overall score, key strengths, and practical
						suggestions. To activate this feature, please update your AI settings.
					</Trans>
				</p>

				<Button
					size="sm"
					variant="outline"
					nativeButton={false}
					render={
						<Link to="/dashboard/settings/integrations">
							<Trans>Open Integrations Settings</Trans>
							<ArrowRightIcon />
						</Link>
					}
				/>
			</AlertDescription>
		</Alert>
	);
}
