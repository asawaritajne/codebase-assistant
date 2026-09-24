import { useMemo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CITATION_HREF_PREFIX, linkCitations } from "../lib/citations";
import type { AnswerSource, AskResponse } from "../types";
import { ShareAnswer } from "./ShareAnswer";
import { SourcesPanel } from "./SourcesPanel";

function CitationChip({ marker, source }: { marker: string; source: AnswerSource | undefined }) {
  if (!source) {
    return (
      <span
        title="This citation doesn't match any retrieved source"
        className="mx-0.5 rounded bg-ember/15 px-1 font-mono text-[0.7rem] font-semibold text-ember line-through ring-1 ring-ember/30"
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
      className="mx-0.5 rounded bg-glow/15 px-1 font-mono text-[0.7rem] font-semibold text-glow no-underline ring-1 ring-glow/30 transition-colors hover:bg-glow/25"
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
      <div role="note" className="mb-4 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
        <p className="font-medium">Parts of this answer couldn't be traced to its sources.</p>
        <p className="mt-0.5 text-amber-200/80">{detail} Check it against the sources below before relying on it.</p>
      </div>
    );
  }

  const count = citations.uncitedParagraphs.length;
  return (
    <p className="mb-4 text-xs text-mist">
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
    <article className="glass rounded-2xl px-5 py-5 shadow-xl shadow-void/40">
      <CitationNotice response={response} />
      <div className="prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:text-chalk prose-p:text-chalk/90 prose-li:text-chalk/90 prose-strong:text-chalk prose-code:text-glow prose-code:before:content-none prose-code:after:content-none prose-pre:bg-void/80 prose-pre:ring-1 prose-pre:ring-white/10 prose-a:text-glow">
        <Markdown remarkPlugins={[remarkGfm]} components={components}>
          {markdown}
        </Markdown>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="font-mono text-[0.7rem] text-mist/70">
          {(response.latencyMs / 1000).toFixed(1)}s · {response.model}
          {response.regenerated && " · regenerated to fix its citations"}
        </p>
        {response.shareId && <ShareAnswer shareId={response.shareId} />}
      </div>
      <SourcesPanel sources={response.sources} />
    </article>
  );
}
