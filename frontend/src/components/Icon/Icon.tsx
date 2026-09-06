import type { SVGProps } from "react";
import "./Icon.scss";

const paths = {
  calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4m8-4v4M4 10h16M8 14h3m-3 3h6" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  user: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2Z" /></>,
  clipboard: <><rect x="5" y="5" width="14" height="16" rx="2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6m-6 4h6" /></>,
  chart: <path d="M3 21h18M5 21v-8h3v8m3 0V8h3v13m3 0V3h3v18" />,
  book: <path d="M12 5v16M3 4h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v15h-5a5 5 0 0 0-4 2 5 5 0 0 0-4-2H3Z" />,
  arrow: <path d="m9 5 7 7-7 7" />,
  alert: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5m0 3h.01" /></>,
  bell: <path d="M5 10a7 7 0 0 1 14 0v5l2 3H3l2-3Zm4 11h6" />,
  paw: <><ellipse cx="5" cy="8" rx="2" ry="3" transform="rotate(-25 5 8)" /><ellipse cx="10" cy="5" rx="2" ry="3" /><ellipse cx="16" cy="5" rx="2" ry="3" /><ellipse cx="21" cy="9" rx="2" ry="3" transform="rotate(25 21 9)" /><path d="M6 18c0-3 3-7 6-7s6 4 6 7-3 3-6 2c-3 1-6 1-6-2Z" /></>,
};
export type IconName = keyof typeof paths;

export function Icon({ name, className = "", ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
    className={`icon ${className}`} {...props}>{paths[name]}</svg>;
}
