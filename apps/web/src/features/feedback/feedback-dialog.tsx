import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ChatCircleDotsIcon, HeadsetIcon, ImageIcon, XIcon } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@reactive-resume/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@reactive-resume/ui/components/dialog";
import { Input } from "@reactive-resume/ui/components/input";
import { Label } from "@reactive-resume/ui/components/label";
import { Spinner } from "@reactive-resume/ui/components/spinner";
import { cn } from "@reactive-resume/utils/style";
import { RichInput } from "@/components/input/rich-input";
import { authClient } from "@/libs/auth/client";
import { orpc } from "@/libs/orpc/client";

/** 提取富文本纯文本用于提交校验。 */
const getPlainText = (html: string) => {
	const template = document.createElement("template");
	template.innerHTML = html;
	return (template.content.textContent ?? "").trim();
};

export function FeedbackDialog() {
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();

	const [open, setOpen] = useState(false);
	const [content, setContent] = useState("");
	const [images, setImages] = useState<string[]>([]);

	const uploadMutation = useMutation(
		orpc.storage.uploadFile.mutationOptions({
			onSuccess: (data) => {
				setImages((current) => [...current, data.url]);
				toast.success(t`Image uploaded successfully.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const submitMutation = useMutation(
		orpc.feedback.submit.mutationOptions({
			onSuccess: () => {
				toast.success(t`Thank you for your feedback!`);
				void queryClient.invalidateQueries({ queryKey: orpc.feedback.listMine.key() });
				setContent("");
				setImages([]);
				setOpen(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) uploadMutation.mutate(file);
		event.target.value = "";
	};

	const handleSubmit = () => {
		if (!getPlainText(content)) {
			toast.error(t`Please enter your feedback.`);
			return;
		}
		submitMutation.mutate({ content, images });
	};

	if (!session?.user) {
		return (
			<Button
				size="icon"
				className="fixed right-6 bottom-6 z-50 size-12 rounded-full shadow-lg"
				title={t`Feedback`}
				onClick={() => toast.error(t`Please sign in to submit feedback.`)}
			>
				<HeadsetIcon className="size-6" />
			</Button>
		);
	}

	return (
		<>
			<Button
				size="icon"
				className="fixed right-6 bottom-6 z-50 size-12 rounded-full shadow-lg"
				title={t`Feedback`}
				onClick={() => setOpen(true)}
			>
				{open ? <XIcon className="size-6" /> : <HeadsetIcon className="size-6" />}
			</Button>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="gap-5 sm:max-w-lg">
					<DialogHeader className="pe-8">
						<DialogTitle className="flex items-center gap-2">
							<ChatCircleDotsIcon className="size-5" />
							<Trans>Feedback</Trans>
						</DialogTitle>
						<DialogDescription>
							<Trans>Welcome to share product suggestions or report issues. Rich text and images are supported.</Trans>
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div>
							<Label>
								<Trans>Content</Trans>
							</Label>
							<RichInput className="mt-2" value={content} onChange={setContent} />
						</div>

						<div>
							<Label>
								<Trans>Images</Trans>
							</Label>
							<div className="mt-2 flex flex-wrap gap-2">
								{images.map((url) => (
									<div key={url} className="group relative size-20 overflow-hidden rounded-lg border">
										<img src={url} alt="" className="size-full object-cover" />
										<button
											type="button"
											aria-label={t`Remove image`}
											className="absolute inset-0 hidden items-center justify-center bg-black/50 group-hover:flex"
											onClick={() => setImages((current) => current.filter((item) => item !== url))}
										>
											<XIcon className="size-4 text-white" />
										</button>
									</div>
								))}
								{images.length < 9 ? (
									<label
										htmlFor="feedback-image-upload"
										className="grid size-20 cursor-pointer place-items-center rounded-lg border border-dashed text-muted-foreground hover:bg-muted/30"
									>
										{uploadMutation.isPending ? (
											<Spinner className="size-4" />
										) : (
											<ImageIcon className="size-5" />
										)}
										<span className="sr-only">
											<Trans>Upload image</Trans>
										</span>
										<Input
											id="feedback-image-upload"
											type="file"
											accept="image/*"
											className="hidden"
											onChange={handleFileChange}
										/>
									</label>
								) : null}
							</div>
							<p className="mt-1 text-muted-foreground text-xs">
								<Trans>You can upload up to 9 images.</Trans>
							</p>
						</div>

						<Button
							type="button"
							className={cn("w-full")}
							disabled={submitMutation.isPending || uploadMutation.isPending}
							onClick={handleSubmit}
						>
							{submitMutation.isPending ? <Spinner className="size-4" /> : <Trans>Submit Feedback</Trans>}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
