import {
  AnnotatedLine,
  LineWithElement,
} from "./partial-step-parser"
import { FullTween, map } from "../utils"
import { easing, stagger } from "./tween"

export function getLinesWithElements(
  lines: AnnotatedLine[],
  lineNumberToIndexMap: FullTween<Map<number, number>>,
  verticalInterval: [number, number],
  enterCount: number,
  exitCount: number
) {
  // startY is the progress when we start moving vertically
  // endY is when we stop
  const [startY, endY] = verticalInterval

  return lines.map(line => {
    const lineIndex = map(
      line.lineNumber,
      (ln, key) => ln && lineNumberToIndexMap[key].get(ln)
    )

    const { enterIndex, exitIndex } = line
    const tweenY =
      line.move === "exit"
        ? { fixed: true, value: lineIndex.prev! }
        : line.move === "enter"
        ? { fixed: true, value: lineIndex.next! }
        : {
            fixed: false,
            extremes: [lineIndex.prev!, lineIndex.next!],
            interval: [startY, endY],
            ease: easing.easeInOutCubic,
          }

    const tweenX =
      line.move === "exit"
        ? {
            fixed: false,
            extremes: [0, -1],
            ease: easing.easeInQuad,
            interval: stagger(
              [0, startY],
              exitIndex!,
              exitCount
            ),
          }
        : line.move === "enter"
        ? {
            fixed: false,
            extremes: [1, 0],
            ease: easing.easeOutQuad,
            interval: stagger(
              [endY, 1],
              enterIndex!,
              enterCount
            ),
          }
        : { fixed: true, value: 0 }

    return {
      ...line,
      tweenX,
      tweenY,
    } as LineWithElement
  })
}
