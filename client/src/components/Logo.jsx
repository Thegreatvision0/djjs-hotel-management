import { useState } from "react";
import clsx from "clsx";

// Official DJJS logo (from djjs.org), served from client/public/djjs-logo.png.
// The artwork is 5:4 with a transparent background; it falls back to a gold "D" monogram if missing.
export const LOGO_SRC = "/djjs-logo.png";

const SIZES = {
  sm: { img: "h-11 w-[55px]", mono: "h-10 w-10 text-xl" },
  md: { img: "h-12 w-[60px]", mono: "h-11 w-11 text-2xl" },
  lg: { img: "h-16 w-20", mono: "h-14 w-14 text-3xl" },
};

export default function Logo({ size = "md", className }) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return <img src={LOGO_SRC} alt="Divya Jyoti Jagrati Sansthan" onError={() => setFailed(true)} className={clsx("shrink-0 object-contain", SIZES[size].img, className)} />;
  }
  return (
    <span className={clsx("grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-500 font-display font-bold text-ink-900", SIZES[size].mono, className)}>D</span>
  );
}
