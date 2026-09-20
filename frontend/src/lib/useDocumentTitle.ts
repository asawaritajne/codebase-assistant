import { useEffect } from "react";
import { SITE_NAME, SITE_TAGLINE } from "../site";

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} — ${SITE_TAGLINE}`;
  }, [title]);
}
