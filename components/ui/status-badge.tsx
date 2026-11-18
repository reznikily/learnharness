import type { Ref } from "react";
import { cn } from "@/lib/utils";

/** Plain-text, noninteractive badge; callers supply any meaning and color. */
export function StatusBadge({ text, color, ref }: { text: string; color?: string; ref?: Ref<HTMLSpanElement> }) {
	return (
		<span
			ref={ref}
			data-slot="status-badge"
			className={cn(
				"relative rounded px-1.5 py-0.5 font-ui text-xs font-medium uppercase tracking-wide",
				color === undefined && "bg-muted text-muted-foreground",
			)}
			style={color === undefined ? undefined : {
				color,
				backgroundColor: `color-mix(in oklab, ${color} 15%, transparent)`,
			}}
		>
			{text}
		</span>
	);
}
