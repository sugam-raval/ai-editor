import React from "react";
import { Title } from "./Title";
import { LowerThird } from "./LowerThird";
import { Callout } from "./Callout";

export const overlayRegistry: Record<string, React.FC<any>> = {
  title: Title,
  lowerThird: LowerThird,
  callout: Callout,
};
