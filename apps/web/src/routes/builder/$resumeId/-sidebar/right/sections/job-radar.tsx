import type { JobMatchSuggestion } from "@reactive-resume/schema/resume/job-match";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { ArrowRightIcon, CrosshairIcon, InfoIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@reactive-resume/ui/components/alert";
import { Button } from "@reactive-resume/ui/components/button";
import { Spinner } from "@reactive-resume/ui/components/spinner";
import { Textarea } from "@reactive-resume/ui/components/textarea";
import { useResume } from "@/features/resume/builder/draft";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";
import { SectionBase } from "../shared/section-base";
import { JobMatchDimensionsSection } from "./job-radar-dimensions";
import { JobMatchGapsSection } from "./job-radar-gaps";
import { JobMatchSuggestionsSection } from "./job-radar-suggestions";
import { JobMatchSummarySection } from "./job-radar-summary";

const analysisSteps = [
	t`Parsing the job description`,
	t`Scoring keyword coverage`,
	t`Comparing skills & experience`,
	t`Generating rewrite suggestions`,
	t`Finalizing the report`,
];

export function JobRadarSectionBuilder() {
	const queryClient = useQueryClient();
	const { i18n } = useLingui();

	const resume = useResume();
	const resumeId = resume?.id ?? "";

	const [jobDescription, setJobDescription] = useState("");
	const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);

	const { data: providers } = useQuery(orpc.aiProviders.list.queryOptions());
	const aiEnabled = providers?.some((provider) => provider.enabled && provider.testStatus === "success") ?? false;

	const { data: history = [] } = useQuery({
		...orpc.ai.listJobAnalysis.queryOptions({ input: { resumeId } }),
		enabled: !!resume,
	});

	const selectedAnalysis = useMemo(
		() => history.find((entry) => entry.id === selectedAnalysisId) ?? history[0] ?? null,
		[history, selectedAnalysisId],
	);

	const { mutate: analyzeJobMatch, isPending } = useMutation({
		...orpc.ai.analyzeJobMatch.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: orpc.ai.listJobAnalysis.queryKey({ input: { resumeId } }) });
			setSelectedAnalysisId(null);
			toast.success(t`Job match analysis complete.`);
		},
		onError: (error) => {
			const description = getOrpcErrorMessage(error, {
				byCode: {
					BAD_REQUEST: t({
						comment: "Error description when AI returns invalid job-match analysis format",
						message: "The AI returned an invalid analysis format. Please try again.",
					}),
					BAD_GATEWAY: t({
						comment: "Error description when AI provider cannot be reached during job-match analysis",
						message: "Could not reach the AI provider. Please try again.",
					}),
					PRECONDITION_FAILED: t({
						comment: "Error description when user has exceeded their resume analysis quota",
						message: "You have exceeded your resume analysis quota.",
					}),
				},
				fallback: t({
					comment: "Fallback error description when job-match analysis request fails",
					message: "Something went wrong while analyzing the job description.",
				}),
			});

			toast.error(t`Failed to analyze job description.`, { description });
		},
	});

	const [polishingTitle, setPolishingTitle] = useState<string | null>(null);
	const [polishedAction, setPolishedAction] = useState<{ id: string; title: string } | null>(null);

	const { mutate: polishSuggestion } = useMutation({
		...orpc.agent.messages.polish.mutationOptions(),
		onSuccess: (action) => {
			setPolishingTitle(null);
			if (action) {
				setPolishedAction({ id: action.id, title: action.title });
				toast.success(t`Resume polished.`);
			} else {
				toast.info(t`No changes were needed for this suggestion.`);
			}
		},
		onError: (error) => {
			setPolishingTitle(null);
			toast.error(t`Failed to polish resume.`, {
				description: getOrpcErrorMessage(error, {
					fallback: t({
						comment: "Fallback error description when polishing a job-match suggestion fails",
						message: "Something went wrong while polishing your resume.",
					}),
				}),
			});
		},
	});

	const { mutate: revertAction, isPending: isReverting } = useMutation({
		...orpc.agent.actions.revert.mutationOptions(),
		onSuccess: () => {
			setPolishedAction(null);
			toast.success(t`Original content restored.`);
		},
		onError: (error) => {
			toast.error(t`Failed to restore original content.`, {
				description: getOrpcErrorMessage(error, {
					fallback: t({
						comment: "Fallback error description when restoring a polished job-match suggestion fails",
						message: "Something went wrong while restoring your resume.",
					}),
				}),
			});
		},
	});

	const onPolish = (suggestion: JobMatchSuggestion) => {
		if (!resume) return;

		setPolishingTitle(suggestion.title);
		polishSuggestion({
			resumeId: resume.id,
			suggestion: {
				title: suggestion.title,
				impact: suggestion.impact,
				why: suggestion.why,
				exampleRewrite: suggestion.exampleRewrite,
				copyPrompt: suggestion.copyPrompt,
			},
		});
	};

	const onRestore = () => {
		if (!polishedAction) return;
		revertAction({ id: polishedAction.id });
	};

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
	}, [isPending]);

	const onAnalyze = () => {
		if (!resume) return;

		analyzeJobMatch({
			resumeId: resume.id,
			jobDescription,
			locale: i18n.locale,
		});
	};

	if (!resume) return null;

	return (
		<SectionBase type="job-radar" className="space-y-4">
			{!aiEnabled && <DisabledState />}

			{aiEnabled && (
				<div className="space-y-3">
					<div className="space-y-4 rounded-md border bg-card p-3">
						<p className="text-base text-muted-foreground">
							<Trans>
								Paste a job description to see how well your resume matches it, and get tailored suggestions to make it
								stand out.
							</Trans>
						</p>

						<Textarea
							value={jobDescription}
							onChange={(event) => setJobDescription(event.target.value)}
							rows={7}
							className="min-h-32 resize-y"
							placeholder={t`Paste the job description here…`}
						/>

						<Button disabled={isPending || jobDescription.trim().length === 0} onClick={onAnalyze} className="w-fit">
							{isPending ? <Spinner /> : <CrosshairIcon />}
							{isPending ? t`Analyzing…` : t`Analyze Job Match`}
						</Button>

						{isPending && (
							<div className="space-y-1">
								<div className="flex items-center justify-between text-base text-muted-foreground">
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

					{history.length > 1 && (
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-muted-foreground text-sm">
								<Trans>Previous analyses</Trans>
							</span>
							{history.map((entry) => (
								<Button
									key={entry.id}
									size="sm"
									variant={entry.id === selectedAnalysis?.id ? "default" : "outline"}
									onClick={() => setSelectedAnalysisId(entry.id)}
								>
									{new Date(entry.createdAt).toLocaleDateString()}
								</Button>
							))}
						</div>
					)}

					{!selectedAnalysis && !isPending && (
						<div className="rounded-md border border-dashed p-3">
							<p className="max-w-xs text-base text-muted-foreground">
								<Trans>Run your first analysis to see how well your resume matches this job.</Trans>
							</p>
						</div>
					)}

					{selectedAnalysis && (
						<div className="space-y-4">
							<JobMatchDimensionsSection analysis={selectedAnalysis.analysis} />
							<JobMatchGapsSection analysis={selectedAnalysis.analysis} />
							<JobMatchSuggestionsSection
								analysis={selectedAnalysis.analysis}
								polishingTitle={polishingTitle}
								polishedAction={polishedAction}
								isReverting={isReverting}
								onPolish={onPolish}
								onKeepChanges={() => setPolishedAction(null)}
								onRestore={onRestore}
							/>
							<JobMatchSummarySection analysis={selectedAnalysis.analysis} />
						</div>
					)}
				</div>
			)}
		</SectionBase>
	);
}

function DisabledState() {
	return (
		<Alert>
			<InfoIcon />
			<AlertDescription className="space-y-3">
				<p>
					<Trans>
						Paste a job description to get a detailed match analysis with a score, gaps, and tailored suggestions. To
						activate this feature, please update your AI settings.
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
