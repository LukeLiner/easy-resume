import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";

const generateTextMock = vi.hoisted(() => vi.fn());
const getDocumentMock = vi.hoisted(() => vi.fn());
const envMock = vi.hoisted(() => ({
	FLAG_ALLOW_UNSAFE_AI_BASE_URL: false,
}));

vi.mock("@reactive-resume/env/server", () => ({ env: envMock }));
vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>();
	return { ...actual, generateText: generateTextMock };
});
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({ getDocument: getDocumentMock }));

afterEach(() => {
	generateTextMock.mockReset();
	getDocumentMock.mockReset();
});

function createPdfDocumentMock(text: string) {
	return {
		promise: Promise.resolve({
			numPages: 1,
			getPage: vi.fn().mockResolvedValue({
				getTextContent: vi.fn().mockResolvedValue({
					items: text.split(" ").map((str) => ({ str })),
				}),
			}),
		}),
		destroy: vi.fn().mockResolvedValue(undefined),
	};
}

const { aiService } = await import("./service");

describe("AI PDF parsing", () => {
	it("sends extracted PDF text instead of an unsupported file part", async () => {
		generateTextMock.mockResolvedValue({ text: JSON.stringify(defaultResumeData) });
		getDocumentMock.mockReturnValue(createPdfDocumentMock("Jane Doe Senior Engineer"));

		await aiService.parsePdf({
			provider: "openai-compatible",
			model: "test-model",
			apiKey: "test-key",
			baseURL: "https://example.test/v1",
			file: { name: "resume.pdf", data: "not-a-real-pdf" },
		});

		const request = generateTextMock.mock.calls[0]?.[0] as { messages: unknown[] };
		const messages = JSON.stringify(request.messages);

		expect(messages).toContain("Jane Doe Senior Engineer");
		expect(messages).toContain("converted to plain text");
		expect(messages).not.toContain('"type":"file"');
	});

	it("falls back to a file message when the PDF has no extractable text", async () => {
		generateTextMock.mockResolvedValue({ text: JSON.stringify(defaultResumeData) });
		getDocumentMock.mockReturnValue(createPdfDocumentMock(""));

		await aiService.parsePdf({
			provider: "openai-compatible",
			model: "test-model",
			apiKey: "test-key",
			baseURL: "https://example.test/v1",
			file: { name: "resume.pdf", data: "not-a-real-pdf" },
		});

		const request = generateTextMock.mock.calls[0]?.[0] as { messages: unknown[] };
		const messages = JSON.stringify(request.messages);

		expect(messages).toContain('"type":"file"');
		expect(messages).toContain("application/pdf");
	});

	it("falls back to a file message when PDF parsing fails", async () => {
		generateTextMock.mockResolvedValue({ text: JSON.stringify(defaultResumeData) });
		getDocumentMock.mockRejectedValue(new Error("Invalid PDF"));

		await aiService.parsePdf({
			provider: "openai-compatible",
			model: "test-model",
			apiKey: "test-key",
			baseURL: "https://example.test/v1",
			file: { name: "resume.pdf", data: "not-a-real-pdf" },
		});

		const request = generateTextMock.mock.calls[0]?.[0] as { messages: unknown[] };
		const messages = JSON.stringify(request.messages);

		expect(messages).toContain('"type":"file"');
	});
});
