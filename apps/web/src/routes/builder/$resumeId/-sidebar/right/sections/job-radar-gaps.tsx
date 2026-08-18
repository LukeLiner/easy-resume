import type { JobMatchAnalysis } from "@reactive-resume/schema/resume/job-match";
import { Trans } from "@lingui/react/macro";
import { CheckIcon, WarningIcon, XIcon } from "@phosphor-icons/react";

type JobMatchGapsSectionProps = {
	analysis: JobMatchAnalysis;
};

export function JobMatchGapsSection({ analysis }: JobMatchGapsSectionProps) {
	if (analysis.gaps.length === 0) return null;

	const covered = analysis.gaps.filter((gap) => gap.covered);
	const uncovered = analysis.gaps.filter((gap) => !gap.covered);

	return (
		<div className="space-y-3 rounded-md border bg-card p-3">
			<h3 className="font-bold">
				<Trans>Requirement Coverage</Trans>
			</h3>

			{uncovered.length > 0 && (
				<div className="space-y-2">
					<p className="font-medium text-red-500 text-sm">
						<Trans>Missing or weak</Trans> ({uncovered.length})
					</p>
					{uncovered.map((gap) => (
						<div key={gap.requirement} className="space-y-1 rounded-md bg-red-500/5 p-2">
							<div className="flex items-start gap-2">
								<XIcon className="mt-0.5 size-3.5 shrink-0 text-red-500" />
								<div className="space-y-1">
									<p className="font-medium text-sm">{gap.requirement}</p>
									{gap.missingKeyword && (
										<p className="text-muted-foreground text-xs">
											<Trans>Keyword</Trans>: <span className="font-mono">{gap.missingKeyword}</span>
										</p>
									)}
									<p className="text-muted-foreground text-xs">{gap.suggestion}</p>
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			{covered.length > 0 && (
				<div className="space-y-2">
					<p className="font-medium text-green-600 text-sm">
						<Trans>Covered</Trans> ({covered.length})
					</p>
					{covered.map((gap) => (
						<div key={gap.requirement} className="flex items-start gap-2 rounded-md bg-green-500/5 p-2">
							<CheckIcon className="mt-0.5 size-3.5 shrink-0 text-green-600" />
							<div className="space-y-1">
								<p className="font-medium text-sm">{gap.requirement}</p>
								{gap.matchedKeyword && (
									<p className="text-muted-foreground text-xs">
										<Trans>Matched</Trans>: <span className="font-mono">{gap.matchedKeyword}</span>
									</p>
								)}
							</div>
						</div>
					))}
				</div>
			)}

			{analysis.gaps.some((gap) => !gap.covered) && (
				<div className="flex items-start gap-2 rounded-md bg-yellow-500/10 p-2">
					<WarningIcon className="mt-0.5 size-3.5 shrink-0 text-yellow-600" />
					<p className="text-muted-foreground text-xs">
						<Trans>
							Tip: Use the suggestions below to weave missing keywords into your existing experience and skills sections
							— never invent achievements.
						</Trans>
					</p>
				</div>
			)}
		</div>
	);
}
