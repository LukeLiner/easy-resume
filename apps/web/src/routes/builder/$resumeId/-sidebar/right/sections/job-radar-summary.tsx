import type { JobMatchAnalysis } from "@reactive-resume/schema/resume/job-match";
import { Trans } from "@lingui/react/macro";
import { ListChecksIcon, SparkleIcon } from "@phosphor-icons/react";

type JobMatchSummarySectionProps = {
	analysis: JobMatchAnalysis;
};

export function JobMatchSummarySection({ analysis }: JobMatchSummarySectionProps) {
	const { summary } = analysis;

	return (
		<div className="space-y-3 rounded-md border bg-card p-3">
			<h5 className="flex items-center gap-2 font-semibold text-base">
				<ListChecksIcon className="text-primary" weight="fill" />
				<Trans>What will change</Trans>
			</h5>

			<div className="grid gap-3 sm:grid-cols-2">
				<div className="space-y-2 rounded-md border bg-muted/50 p-3">
					<p className="font-semibold text-muted-foreground text-sm">
						<Trans>Before</Trans>
					</p>
					<ul className="space-y-1.5">
						{summary.before.map((item) => (
							<li key={item} className="text-base text-muted-foreground">
								• {item}
							</li>
						))}
					</ul>
				</div>

				<div className="space-y-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
					<p className="flex items-center gap-1.5 font-semibold text-emerald-700 text-sm dark:text-emerald-400">
						<SparkleIcon className="size-4" />
						<Trans>After</Trans>
					</p>
					<ul className="space-y-1.5">
						{summary.after.map((item) => (
							<li key={item} className="text-emerald-700 dark:text-emerald-400">
								• {item}
							</li>
						))}
					</ul>
				</div>
			</div>

			<p className="text-base text-muted-foreground">{summary.overall}</p>
		</div>
	);
}
