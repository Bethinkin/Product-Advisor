declare module "webvtt-parser" {
  export interface VttCue {
    text: string;
    startTime: number;
    endTime: number;
    identifier?: string;
  }
  export interface VttTree {
    cues: VttCue[];
    errors: unknown[];
  }
  export class WebVTTParser {
    parse(input: string, mode?: string): VttTree;
  }
  export class WebVTTSerializer {
    serialize(tree: VttTree): string;
  }
}
