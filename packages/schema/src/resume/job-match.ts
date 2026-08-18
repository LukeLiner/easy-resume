import z from "zod";

export const jobMatchDimensionSchema = z.object({
	dimension: z.enum(["keyword", "gap", "wording", "quantification", "ordering", "format"]),
	label: z.string().min(1),
	score: z.number().int().min(0).max(100),
	rationale: z.string().min(1),
});

export const jobMatchSuggestionSchema = z.object({
	title: z.string().min(1),
	impact: z.enum(["high", "medium", "low"]),
	dimension: z.enum(["keyword", "gap", "wording", "quantification", "ordering", "format"]),
	why: z.string().min(1),
	exampleRewrite: z.string().nullable(),
	copyPrompt: z.string().min(1),
});

export const jobRequirementSchema = z.object({
	skills: z.array(z.string().min(1)).max(40),
	experience: z.array(z.string().min(1)).max(20),
	softSkills: z.array(z.string().min(1)).max(20),
	bonus: z.array(z.string().min(1)).max(20),
});

export const jobGapSchema = z.object({
	requirement: z.string().min(1),
	category: z.enum(["skills", "experience", "softSkills", "bonus"]),
	covered: z.boolean(),
	matchedKeyword: z.string().nullable(),
	missingKeyword: z.string().nullable(),
	suggestion: z.string().min(1),
});

export const jobSummarySchema = z.object({
	before: z.array(z.string().min(1)).max(10),
	after: z.array(z.string().min(1)).max(10),
	overall: z.string().min(1),
});

export const jobMatchAnalysisSchema = z.object({
	role: z.string().min(1),
	parsedRequirements: jobRequirementSchema,
	matchScore: z.number().int().min(0).max(100),
	dimensions: z.array(jobMatchDimensionSchema).min(6).max(6),
	gaps: z.array(jobGapSchema).max(30),
	suggestions: z.array(jobMatchSuggestionSchema).max(12),
	summary: jobSummarySchema,
});

export const storedJobMatchAnalysisSchema = jobMatchAnalysisSchema.extend({
	jdText: z.string().min(1),
	updatedAt: z.coerce.date(),
	modelMeta: z.object({
		provider: z.string().min(1),
		model: z.string().min(1),
	}),
});

export type JobMatchAnalysis = z.infer<typeof jobMatchAnalysisSchema>;

export type JobMatchSuggestion = z.infer<typeof jobMatchSuggestionSchema>;

export type StoredJobMatchAnalysis = z.infer<typeof storedJobMatchAnalysisSchema>;
