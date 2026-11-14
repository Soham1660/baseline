import { Composition, Still } from "remotion";
import { Teaser, TEASER_TOTAL, Thumbnail } from "./Teaser";
import { Demo60, DEMO_TOTAL } from "./Demo60";
import { Pitch120, PITCH_TOTAL } from "./Pitch120";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Demo60"
        component={Demo60}
        durationInFrames={DEMO_TOTAL}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ appUrl: "baseline-vby8.onrender.com", withScore: true }}
      />
      <Composition
        id="Pitch120"
        component={Pitch120}
        durationInFrames={PITCH_TOTAL}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ founderName: "Soham", founderHandle: "github.com/Soham1660", founderClip: "", appUrl: "baseline-vby8.onrender.com", withScore: true }}
      />
      <Composition
        id="TeaserVertical"
        component={Teaser}
        durationInFrames={TEASER_TOTAL}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ appUrl: "baseline-vby8.onrender.com", withScore: true }}
      />
      <Still id="YouTubeThumbnail" component={Thumbnail} width={1280} height={720} />
    </>
  );
};
