import { Trans } from "@lingui/react/macro";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@reactive-resume/ui/components/dialog";

type ImagePreviewDialogProps = {
	open: boolean;
	src: string;
	alt: string;
	onOpenChange: (open: boolean) => void;
};

export function ImagePreviewDialog({ open, src, alt, onOpenChange }: ImagePreviewDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						<Trans>Preview</Trans>
					</DialogTitle>
					<DialogDescription className="sr-only">{alt}</DialogDescription>
				</DialogHeader>
				<img src={src} alt={alt} className="mx-auto max-h-[70vh] rounded-lg border object-contain" />
			</DialogContent>
		</Dialog>
	);
}
