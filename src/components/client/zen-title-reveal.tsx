import ZenTextReveal from "@zazencode/ui/text-reveal";
import textReveal from "@zazencode/ui/text-reveal-motion";

const { titleTransitionName } = textReveal;

interface Props {
  text: string;
}

// Same reveal component and timing as the home list titles; the shared transition name lets
// the title morph from the list, in which case it arrives visible and the reveal is skipped.
// Lines are laid out from the h1's computed font, so its responsive CSS size stays the source of truth.
const ZenTitleReveal = ({ text }: Props) => (
  <ZenTextReveal
    tag="h1"
    text={text}
    measureFont
    lineDisplay="block"
    // header-init focuses the page heading after a client-side swap
    tabIndex={-1}
    viewTransitionName={titleTransitionName(text)}
  />
);

export default ZenTitleReveal;
