import type { JobMatchStreamErrorCode, JobMatchSuggestion } from "@reactive-resume/schema/resume/job-match";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { eventIteratorToUnproxiedDataStream } from "@orpc/client";
import { ArrowRightIcon, CrosshairIcon, InfoIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@reactive-resume/ui/components/alert";
import { Button } from "@reactive-resume/ui/components/button";
import { Spinner } from "@reactive-resume/ui/components/spinner";
import { Textarea } from "@reactive-resume/ui/components/textarea";
import { useResume } from "@/features/resume/builder/draft";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { orpc, streamClient } from "@/libs/orpc/client";
import { SectionBase } from "../shared/section-base";
import { JobMatchDimensionsSection } from "./job-radar-dimensions";
import { JobMatchGapsSection } from "./job-radar-gaps";
import { JobMatchSuggestionsSection } from "./job-radar-suggestions";
import { JobMatchSummarySection } from "./job-radar-summary";

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

	const [isStreaming, setIsStreaming] = useState(false);
	const [streamingText, setStreamingText] = useState("");
	const streamingTextRef = useRef<HTMLPreElement>(null);

	useEffect(() => {
		if (streamingTextRef.current) {
			streamingTextRef.current.scrollTop = streamingTextRef.current.scrollHeight;
		}
	}, [streamingText]);

	const getStreamErrorDescription = (code: JobMatchStreamErrorCode): string => {
		switch (code) {
			case "BAD_REQUEST":
				return t`The AI returned an invalid analysis format. Please try again.`;
			case "BAD_GATEWAY":
				return t`Could not reach the AI provider. Please try again.`;
			case "PRECONDITION_FAILED":
				return t`You have exceeded your resume analysis quota.`;
			default:
				return t`Something went wrong while analyzing the job description.`;
		}
	};

	const onAnalyze = async () => {
		if (!resume) return;

		setStreamingText("");
		setIsStreaming(true);
		setSelectedAnalysisId(null);

		try {
			const stream = eventIteratorToUnproxiedDataStream(
				await streamClient.ai.analyzeJobMatchStream({
					resumeId: resume.id,
					jobDescription,
					locale: i18n.locale,
				}),
			);

			const reader = stream.getReader();

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				if (value.type === "text") {
					setStreamingText((current) => current + value.text);
				} else if (value.type === "complete") {
					setStreamingText("");
					await queryClient.invalidateQueries({ queryKey: orpc.ai.listJobAnalysis.queryKey({ input: { resumeId } }) });
					setSelectedAnalysisId(null);
					toast.success(t`Job match analysis complete.`);
				} else if (value.type === "error") {
					toast.error(t`Failed to analyze job description.`, {
						description: getStreamErrorDescription(value.code),
					});
				}
			}
		} catch (error) {
			const description = getOrpcErrorMessage(error, {
				byCode: {
					BAD_REQUEST: t`The AI returned an invalid analysis format. Please try again.`,
					BAD_GATEWAY: t`Could not reach the AI provider. Please try again.`,
					PRECONDITION_FAILED: t`You have exceeded your resume analysis quota.`,
				},
				fallback: t`Something went wrong while analyzing the job description.`,
			});

			toast.error(t`Failed to analyze job description.`, { description });
		} finally {
			setIsStreaming(false);
		}
	};

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

						<Button disabled={isStreaming || jobDescription.trim().length === 0} onClick={onAnalyze} className="w-fit">
							{isStreaming ? <Spinner /> : <CrosshairIcon />}
							{isStreaming ? t`Analyzing…` : t`Analyze Job Match`}
						</Button>

						{isStreaming && (
							<div className="space-y-2">
								<div className="flex items-center justify-between text-base text-muted-foreground">
									<span>{t`Generating your report…`}</span>
									<Spinner className="size-4" />
								</div>
								<pre
									ref={streamingTextRef}
									className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-muted p-3 font-mono text-muted-foreground text-xs"
								>
									{streamingText || t`Waiting for AI to start writing…`}
								</pre>
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

					{!selectedAnalysis && !isStreaming && (
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
