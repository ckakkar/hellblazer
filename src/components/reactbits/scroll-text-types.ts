/**
 * The scroll-motion kit's shared props (split-text, scroll-float,
 * scroll-reveal). `text` is the words as plain text; "\n" in it is a forced
 * line break. The whole string stays readable to assistive tech and search
 * (one label on the element); the pieces that move are hidden from it.
 */
export type MotionTag = "h1" | "h2" | "h3" | "p" | "span" | "div";

export type MotionTextProps = {
  text: string;
  as?: MotionTag;
  className?: string;
};
