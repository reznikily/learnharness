export type VisualPassage = {text: string} | {jobId: string};
/** Only standalone links outside code fences become executable artifact slots. */
export function splitVisualReferences(text: string): VisualPassage[] {
 const out: VisualPassage[] = []; let buffer = ''; let fence = '';
 for (const line of text.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
  const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
  if (marker) { if (!fence) fence = marker; else if (marker[0] === fence[0] && marker.length >= fence.length) fence = ''; buffer += line; continue; }
  const match = !fence && /^\[visual\]\(lh-artifact:([A-Za-z0-9_-]+)\)\s*$/.exec(line);
  if (match) { if (buffer) out.push({text:buffer}); buffer = ''; out.push({jobId:match[1]!}); }
  else buffer += line;
 }
 if (buffer) out.push({text:buffer});
 return out;
}
