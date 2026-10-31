"use client";

import { useContext, useMemo } from "react";
import { JobsContext } from "../jobs-context";
import { MessageResponse } from "../ai-elements/message";
import { DemoOutputCard } from "./demo-card";
import { splitVisualReferences } from "@/src/core";
import type { LhViewMessage, SubagentArtifactData } from "../../src/core";

export function InlineVisualText({ text, messages }: { text: string; messages: LhViewMessage[] }) {
	const jobs = useContext(JobsContext);
	const passages = useMemo(() => splitVisualReferences(text), [text]);
	return <>{passages.map((part, index) => {
		if ("text" in part) return <MessageResponse key={index}>{part.text}</MessageResponse>;
		const job = jobs.find(j => j.id === part.jobId);
		const delivered = messages.find(m => (m.metadata as { subagentResult?: { jobId: string } } | undefined)?.subagentResult?.jobId === part.jobId);
		const data = delivered?.parts.find(p => p.type === "data-subagent-artifact")?.data as SubagentArtifactData | undefined;
		const result = data?.result ?? job?.result;
		if (result && typeof result === "object" && "html" in result) {
			if (result.html === "") return <div key={index} role="status" className="my-3 text-sm text-muted-foreground">{"notes" in result ? String(result.notes) : "Не удалось создать визуализацию"}</div>;
			return <DemoOutputCard key={index} output={result} messageId={delivered?.id} />;
		}
		return <div key={index} role="status" className="my-3 text-sm text-muted-foreground">{job?.status === "error" ? (job.error ?? "Не удалось создать визуализацию") : job || delivered ? "Подготовка визуализации…" : "Визуализация недоступна"}</div>;
	})}</>;
}

export function referencedVisualJobs(messages: LhViewMessage[]): Set<string> {
	return new Set(messages.filter(m => m.role === "assistant").flatMap(m => m.parts.flatMap(p =>
		p.type === "text" ? splitVisualReferences(p.text ?? "").flatMap(v => "jobId" in v ? [v.jobId] : []) : [],
	)));
}
