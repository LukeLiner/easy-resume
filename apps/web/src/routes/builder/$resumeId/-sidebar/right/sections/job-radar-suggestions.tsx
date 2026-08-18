import type { JobMatchAnalysis, JobMatchSuggestion } from "@reactive-resume/schema/resume/job-match";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ArrowsClockwiseIcon, CheckCircleIcon, LightbulbIcon, MagicWandIcon } from "@phosphor-icons/react";
import { Button } from "@reactive-resume/ui/components/button";
import { Spinner } from "@reactive-resume/ui/components/spinner";

type JobMatchSuggestionsSectionProps = {
	analysis: JobMatchAnalysis;
	polishingTitle: string | null;
	polishedAction: { id: string; title: string } | null;
	isReverting: boolean;
	onPolish: (suggestion: JobMatchSuggestion) => void;
	onKeepChanges: () => void;
	onRestore: () => void;
};

function impactCircleClass(impact: JobMatchSuggestion["impact"]): string {
	switch (impact) {
		case "high":
			return "bg-rose-600";
		case "medium":
			return "bg-amber-600";
		case "low":
			return "bg-emerald-600";
		default:
			return "bg-muted";
	}
}

function impactLabel(impact: JobMatchSuggestion["impact"]): string {
	switch (impact) {
		case "high":
			return t({
				comment: "Label for high-impact job-match suggestions",
				message: "High impact",
			});
		case "medium":
			return t({
				comment: "Label for medium-impact job-match suggestions",
				message: "Medium impact",
			});
		case "low":
			return t({
				comment: "Label for low-impact job-match suggestions",
				message: "Low impact",
			});
		default:
			return t({
				comment: "Label for unknown-impact job-match suggestions",
				message: "Impact",
			});
	}
}

export function JobMatchSuggestionsSection({
	analysis,
	polishingTitle,
	polishedAction,
	isReverting,
	onPolish,
	onKeepChanges,
	onRestore,
}: JobMatchSuggestionsSectionProps) {
	if (analysis.suggestions.length === 0) return null;

	return (
		<div className="space-y-4 rounded-md border bg-card p-3">
			<h5 className="flex items-center gap-2 font-semibold text-amber-700 text-base dark:text-amber-400">
				<LightbulbIcon className="text-amber-600" weight="fill" />
				<Trans>Suggestions</Trans>
			</h5>

			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-muted-foreground">
				<span className="inline-flex items-center gap-1.5">
					<span aria-hidden="true" className="size-2 rounded-full bg-rose-600" />
					{t({
						comment: "Legend label for high-impact job-match suggestions",
						message: "High impact",
					})}
				</span>
				<span className="inline-flex items-center gap-1.5">
					<span aria-hidden="true" className="size-2 rounded-full bg-amber-600" />
					{t({
						comment: "Legend label for medium-impact job-match suggestions",
						message: "Medium impact",
					})}
				</span>
				<span className="inline-flex items-center gap-1.5">
					<span aria-hidden="true" className="size-2 rounded-full bg-emerald-600" />
					{t({
						comment: "Legend label for low-impact job-match suggestions",
						message: "Low impact",
					})}
				</span>
			</div>

			<div className="space-y-3">
				{analysis.suggestions.map((suggestion) => (
					<div key={suggestion.title} className="space-y-3 rounded-md border p-3">
						<div className="flex items-center gap-2">
							<span
								aria-hidden="true"
								className={`size-2.5 shrink-0 rounded-full ring-1 ring-border ${impactCircleClass(suggestion.impact)}`}
								title={impactLabel(suggestion.impact)}
							/>
							<span className="sr-only">{impactLabel(suggestion.impact)}</span>
							<div className="font-semibold text-base tracking-tight">{suggestion.title}</div>
						</div>

						<div className="text-base text-muted-foreground">{suggestion.why}</div>

						{suggestion.exampleRewrite && (
							<div className="rounded bg-muted p-2 text-base text-muted-foreground">{suggestion.exampleRewrite}</div>
						)}

						<div className="flex items-center justify-end gap-2">
							{polishingTitle === suggestion.title ? (
								<Button size="sm" variant="outline" disabled>
									<Spinner />
									{t({
										comment: "Button label shown while polishing a job-match suggestion",
										message: "Polishing…",
									})}
								</Button>
							) : (
								polishedAction?.title !== suggestion.title && (
									<Button size="sm" variant="outline" onClick={() => onPolish(suggestion)}>
										<MagicWandIcon />
										{t({
											comment: "Button label to apply an AI polish to a job-match suggestion",
											message: "Polish",
										})}
									</Button>
								)
							)}
						</div>

						{polishedAction?.title === suggestion.title && (
							<div className="space-y-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
								<p className="flex items-center gap-2 text-base text-emerald-700 dark:text-emerald-400">
									<CheckCircleIcon className="shrink-0 text-emerald-600" weight="fill" />
									<Trans>Polished! Keep the changes or restore the original.</Trans>
								</p>
								<div className="flex items-center gap-2">
									<Button size="sm" onClick={onKeepChanges}>
										<Trans>Keep changes</Trans>
									</Button>
									<Button size="sm" variant="outline" onClick={onRestore} disabled={isReverting}>
										{isReverting ? <Spinner /> : <ArrowsClockwiseIcon />}
										<Trans>Restore original</Trans>
									</Button>
								</div>
							</div>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
