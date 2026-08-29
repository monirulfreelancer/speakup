/*
 * The SpeakUp mark: a speech bubble with an equaliser inside it.
 *
 * Inlined rather than an <img> so it stays crisp at any size, inherits the
 * page's rendering, and costs no extra request. The gradient id is
 * namespaced because several logos can appear on one page (header and
 * hero), and duplicate ids would make the second one reference the first.
 */

export function Logo({
  size = 40,
  className = "",
  title = "SpeakUp",
}: {
  size?: number;
  className?: string;
  /** Set to null for decorative use beside the wordmark. */
  title?: string | null;
}) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      role={title ? "img" : "presentation"}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id="speakup-logo-tile" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4ADE80" />
          <stop offset="1" stopColor="#16A34A" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#speakup-logo-tile)" />
      <path
        fill="#FFFFFF"
        d="M 152 104 H 360 a 72 72 0 0 1 72 72 v 144 a 72 72 0 0 1 -72 72 H 250 c -28 0 -40 34 -78 46 a 12 12 0 0 1 -15 -15 c 10 -24 9 -33 3 -33 a 72 72 0 0 1 -72 -70 v -144 a 72 72 0 0 1 72 -72 z"
      />
      <g fill="#15803D">
        <rect x="164" y="222" width="30" height="52" rx="15" />
        <rect x="212" y="192" width="30" height="112" rx="15" />
        <rect x="260" y="164" width="30" height="168" rx="15" />
        <rect x="308" y="200" width="30" height="96" rx="15" />
        <rect x="356" y="228" width="30" height="40" rx="15" />
      </g>
    </svg>
  );
}
