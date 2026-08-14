import z from "zod";

// ponytail: z.enum([...]) over z.literal calls; same parse behavior, same inferred union type
export const localeSchema = z.enum(["en-US", "zh-CN"]);

export type Locale = z.infer<typeof localeSchema>;

export const defaultLocale: Locale = "zh-CN";

export function isLocale(value: unknown): value is Locale {
	return localeSchema.safeParse(value).success;
}

export function isCJKLocale(locale: Locale): boolean {
	return locale === "zh-CN";
}

// A writing system that needs a dedicated fallback font in the PDF renderer,
// because react-pdf (unlike a browser) has no automatic system-font fallback:
// a glyph only renders if a registered font contains it. We pick the matching
// Noto font per script so e.g. Hangul → Noto KR, Arabic → Noto Arabic, instead
// of falling back to a Latin/Han-only font and producing tofu.
export type Script = "hangul" | "kana" | "han-traditional" | "han-simplified" | "arabic" | "hebrew" | "thai";

// The CJK subset of `Script`. CJK needs extra per-character line breaking that
// must NOT be applied to Arabic (cursive, joined letters) or Thai (combining
// marks), so callers gate line-breaking on this rather than on `Script`.
const cjkScripts: readonly Script[] = ["hangul", "kana", "han-traditional", "han-simplified"];

export function isCjkScript(script: Script): boolean {
	return cjkScripts.includes(script);
}

// The script a locale primarily uses, used to order the fallback stack so the
// dominant language renders with its native font.
export function getLocaleScript(locale?: Locale): Script | null {
	return locale === "zh-CN" ? "han-simplified" : null;
}

const RTL_LANGUAGES = new Set([
	"ar", // Arabic
	"ckb", // Kurdish (Sorani)
	"dv", // Dhivehi
	"fa", // Persian
	"he", // Hebrew
	"ps", // Pashto
	"sd", // Sindhi
	"ug", // Uyghur
	"ur", // Urdu
	"yi", // Yiddish
]);

export function isRTL(locale: string): boolean {
	const language = locale.split("-")[0]?.toLowerCase() ?? "";
	return RTL_LANGUAGES.has(language);
}
