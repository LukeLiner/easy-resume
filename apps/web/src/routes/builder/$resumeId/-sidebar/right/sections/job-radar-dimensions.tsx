import type { JobMatchAnalysis } from "@reactive-resume/schema/resume/job-match";
import { Trans } from "@lingui/react/macro";
import { CrosshairIcon } from "@phosphor-icons/react";
import { cn } from "@reactive-resume/utils/style";

type JobMatchDimensionsSectionProps = {
	analysis: JobMatchAnalysis;
};

export function JobMatchDimensionsSection({ analysis }: JobMatchDimensionsSectionProps) {
	return (
		<div className="space-y-3 rounded-md border bg-card p-3">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<CrosshairIcon className="size-4" />
					<h3 className="font-bold">
						<Trans>Six-Dimension Analysis</Trans>
					</h3>
				</div>
				<span className="text-muted-foreground text-sm">
					<Trans>Match score</Trans>
				</span>
			</div>

			<div className="space-y-2">
				<div className="flex items-center gap-2">
					<span className="font-black text-3xl">{analysis.matchScore}</span>
					<span className="text-muted-foreground text-sm">/ 100</span>
				</div>
				<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
					<div
						className={cn(
							"h-full rounded-full",
							analysis.matchScore >= 70 && "bg-green-500",
							analysis.matchScore >= 40 && analysis.matchScore < 70 && "bg-yellow-500",
							analysis.matchScore < 40 && "bg-red-500",
						)}
						style={{ width: `${analysis.matchScore}%` }}
					/>
				</div>
			</div>

			<div className="space-y-3 pt-2">
				{analysis.dimensions.map((item) => (
					<div key={item.dimension} className="space-y-1">
						<div className="flex items-center justify-between text-sm">
							<span className="font-medium">{item.label}</span>
							<span className="text-muted-foreground">{item.score}/100</span>
						</div>
						<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
							<div
								className={cn(
									"h-full rounded-full",
									item.score >= 70 && "bg-green-500",
									item.score >= 40 && item.score < 70 && "bg-yellow-500",
									item.score < 40 && "bg-red-500",
								)}
								style={{ width: `${item.score}%` }}
							/>
						</div>
						<p className="text-muted-foreground text-xs leading-relaxed">{item.rationale}</p>
					</div>
				))}
			</div>
		</div>
	);
}
