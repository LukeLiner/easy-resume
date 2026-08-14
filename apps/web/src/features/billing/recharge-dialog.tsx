import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { UploadSimpleIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { orpc } from "@/libs/orpc/client";

const PRESET_AMOUNTS_YUAN = [10, 20, 50, 100, 200];

type RechargeDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function RechargeDialog({ open, onOpenChange }: RechargeDialogProps) {
	const queryClient = useQueryClient();

	const [amountYuan, setAmountYuan] = useState("10");
	const [proofUrl, setProofUrl] = useState<string | null>(null);
	const [contactEmail, setContactEmail] = useState("");
	const [previewOpen, setPreviewOpen] = useState(false);

	const configQuery = useQuery(orpc.payment.getConfig.queryOptions());
	const config = configQuery.data;
	const minRechargeCents = config?.minRechargeCents ?? 1000;
	const minRechargeYuan = minRechargeCents / 100;

	const amountCents = Math.round(Number(amountYuan) * 100);
	const isValidAmount =
		Number.isFinite(amountCents) && amountCents >= minRechargeCents && amountCents % minRechargeCents === 0;

	const uploadMutation = useMutation(
		orpc.storage.uploadFile.mutationOptions({
			onSuccess: (data) => setProofUrl(data.url),
			onError: (error) => toast.error(error.message),
		}),
	);

	const submitMutation = useMutation(
		orpc.payment.submitRecharge.mutationOptions({
			onSuccess: () => {
				toast.success(t`Recharge request submitted. We will review it shortly.`);
				void queryClient.invalidateQueries({ queryKey: orpc.billing.getUserCenter.key() });
				void queryClient.invalidateQueries({ queryKey: orpc.billing.listTransactions.key() });
				onOpenChange(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const submit = () => {
		if (!isValidAmount || !proofUrl) return;
		submitMutation.mutate({
			amount: amountCents,
			proofUrl,
			contactEmail: contactEmail || undefined,
		});
	};

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="gap-5 sm:max-w-md">
					<DialogHeader className="pe-8">
						<DialogTitle>
							<Trans>Top Up</Trans>
						</DialogTitle>
						<DialogDescription>
							<Trans>Scan the code below with WeChat to pay, then upload your payment proof.</Trans>
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						{config?.qrCodeUrl ? (
							<div className="flex flex-col items-center gap-3">
								<button
									type="button"
									onClick={() => setPreviewOpen(true)}
									aria-label={t`Click to enlarge the payment QR code`}
									className="group cursor-zoom-in overflow-hidden rounded-lg border"
								>
									<img
										src={config.qrCodeUrl}
										alt={t`Payment QR code`}
										className="size-72 object-contain transition-transform duration-200 group-hover:scale-105"
									/>
								</button>
								<p className="text-center text-muted-foreground text-sm">
									<Trans>Please scan the code with WeChat to complete the payment.</Trans>
								</p>
								<p className="text-center text-muted-foreground text-xs">
									<Trans>Click the QR code to enlarge it.</Trans>
								</p>
							</div>
						) : (
							<p className="text-center text-muted-foreground text-sm">
								<Trans>Payment QR code is not configured yet. Please contact support.</Trans>
							</p>
						)}

						<div>
							<Label>
								<Trans>Amount</Trans>
							</Label>
							<div className="mt-2 grid grid-cols-5 gap-2">
								{PRESET_AMOUNTS_YUAN.map((yuan) => (
									<Button
										key={yuan}
										type="button"
										size="sm"
										variant={Number(amountYuan) === yuan ? "default" : "outline"}
										onClick={() => setAmountYuan(String(yuan))}
									>
										¥{yuan}
									</Button>
								))}
							</div>
							<div className="mt-2">
								<Input
									type="number"
									min={minRechargeYuan}
									step={minRechargeYuan}
									value={amountYuan}
									onChange={(event) => setAmountYuan(event.target.value)}
								/>
							</div>
							<p className="mt-1 text-muted-foreground text-xs">
								<Trans>Only multiples of ¥{minRechargeYuan} are accepted.</Trans>
							</p>
						</div>

						<p className="rounded-lg bg-muted/40 p-3 text-muted-foreground text-xs">
							<Trans>
								Every ¥1 get per download, Every ¥2 get 1 resume analyses, Every ¥2 get 1 conversation generations.
							</Trans>
						</p>

						<div>
							<Label htmlFor="proof-file">
								<Trans>Payment proof</Trans>
								 <span style={{ fontSize: '12px', color: 'red' }}>
        (扫描支付成功后，把支付截图上传)
      </span>
							</Label>
							<label
								htmlFor="proof-file"
								className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-muted-foreground text-sm hover:bg-muted/30"
							>
								<UploadSimpleIcon className="size-4" />
								{proofUrl ? <Trans>Uploaded</Trans> : <Trans>Click to upload</Trans>}
							</label>
							<Input
								id="proof-file"
								type="file"
								accept="image/*"
								className="hidden"
								onChange={(event) => {
									const file = event.target.files?.[0];
									if (file) uploadMutation.mutate(file);
								}}
							/>
						</div>

						<div>
							<Label htmlFor="contact-email">
								<Trans>Email</Trans>
								<span style={{ fontSize: '12px', color: 'red' }}>
        (填写注册邮箱)
      </span>
							</Label>
							<Input
								id="contact-email"
								type="email"
								value={contactEmail}
								onChange={(event) => setContactEmail(event.target.value)}
							/>
						</div>

						<Button
							type="button"
							className="w-full"
							disabled={!isValidAmount || !proofUrl || submitMutation.isPending}
							onClick={submit}
						>
							{submitMutation.isPending ? <Spinner className="size-4" /> : <Trans>Submit for Review</Trans>}
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{config?.qrCodeUrl ? (
				<Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
					<DialogContent className="sm:max-w-xl">
						<DialogHeader>
							<DialogTitle>
								<Trans>Payment QR code</Trans>
							</DialogTitle>
						</DialogHeader>
						<img
							src={config.qrCodeUrl}
							alt={t`Payment QR code`}
							className="w-full rounded-lg border object-contain"
						/>
					</DialogContent>
				</Dialog>
			) : null}
		</>
	);
}
