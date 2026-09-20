import { useMemo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CITATION_HREF_PREFIX, linkCitations } from "../lib/citations";
import type { AnswerSource, AskResponse } from "../types";
import { SourcesPanel } from "./SourcesPanel";

function CitationChip({ marker, source }: { marker: string; source: AnswerSource | undefined }) {
  if (!source) {
    return (
      <span
        title="This citation doesn't match any retrieved source"
        className="mx-0.5 rounded bg-red-50 px-1 font-mono text-[0.7rem] font-semibold text-red-700 line-through ring-1 ring-red-200"
      >
        {marker}
      </span>
    );
  }

  const lines = source.startLine ? ` (lines ${source.startLine}–${source.endLine})` : "";
  return (
    <a
      href={source.sourceUrl}
      target="_blank"
      rel="noreferrer"
      title={`${source.title}${lines}`}
      className="mx-0.5 rounded bg-indigo-50 px-1 font-mono text-[0.7rem] font-semibold text-indigo-700 no-underline ring-1 ring-indigo-200 hover:bg-indigo-100"
    >
      {marker}
    </a>
  );
}

/** Surfaces the backend's citation check, so a poorly grounded answer never looks trustworthy. */
function CitationNotice({ response }: { response: AskResponse }) {
  const { citations, sources } = response;
  if (citations.valid || sources.length === 0) return null;

  if (citations.invalidMarkers.length > 0 || citations.citedMarkers.length === 0) {
    const detail =
      citations.invalidMarkers.length > 0
        ? `It refers to ${citations.invalidMarkers.join(", ")}, which ${citations.invalidMarkers.length === 1 ? "doesn't" : "don't"} match any retrieved source.`
        : "It doesn't cite any of the retrieved sources.";
    return (
      <div role="note" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <p className="font-medium">Parts of this answer couldn't be traced to its sources.</p>
        <p className="mt-0.5">{detail} Check it against the sources below before relying on it.</p>
      </div>
    );
  }

  const count = citations.uncitedParagraphs.length;
  return (
    <p className="mb-3 text-xs text-slate-500">
      {count === 1 ? "1 statement in this answer doesn't" : `${count} statements in this answer don't`} cite a source.
    </p>
  );
}

export function AnswerCard({ response }: { response: AskResponse }) {
  const markdown = useMemo(() => linkCitations(response.answer), [response.answer]);

  const components = useMemo<Components>(() => {
    const sourcesByMarker = new Map(response.sources.map((source) => [source.marker, source]));
    return {
      a({ href, children }) {
        if (href?.startsWith(CITATION_HREF_PREFIX)) {
          const marker = href.slice(CITATION_HREF_PREFIX.length);
          return <CitationChip marker={marker} source={sourcesByMarker.get(marker)} />;
        }
        return (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        );
      },
    };
  }, [response.sources]);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <CitationNotice response={response} />
      <div className="prose prose-sm max-w-none prose-slate prose-headings:font-semibold prose-code:before:content-none prose-code:after:content-none prose-pre:bg-slate-900">
        <Markdown remarkPlugins={[remarkGfm]} components={components}>
          {markdown}
        </Markdown>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Answered in {(response.latencyMs / 1000).toFixed(1)}s · {response.model}
        {response.regenerated && " · regenerated to fix its citations"}
      </p>
      <SourcesPanel sources={response.sources} />
    </article>
  );
}
