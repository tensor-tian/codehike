import {
  FocusString,
  FullTween,
  LinesString,
  Tween,
  getLineNumIndexes,
  map,
  withDefault,
} from "../utils"
import {
  annotateInline,
  annotateMultiline,
  parseAnnotations,
} from "./annotations"

import React from "react"
import { TweenParams } from "./tween"
import { getLinesWithElements } from "./line-elements"
import { mergeLines } from "./differ"
import { splitByFocus } from "./splitter"

export type AnnotationProps = {
  style?: React.CSSProperties
  children: React.ReactNode
  data: any
  isInline: boolean
}

export type CodeAnnotation = {
  focus: string
  Component?: (props: AnnotationProps) => React.ReactElement
  data?: any
  // sometimes serializing the Component function doesn't work (Astro)
  // so we pass the name and get the Component from annotationsMap
  // name?: string
}
type ParseInput = {
  focus: Tween<FocusString>
  lineNums: Tween<LinesString>
  annotations?: Tween<CodeAnnotation[] | undefined>
  highlightedLines: FullTween<HighlightedLine[]>
  lang: string
}

export function useStepParser(input: ParseInput) {
  const { highlightedLines, focus, lineNums } = input
  return React.useMemo(
    () => parse(input),
    [
      highlightedLines.prev,
      highlightedLines.next,
      focus.prev,
      focus.next,
      lineNums.prev,
      lineNums.next,
    ]
  )
}
let mark = 0

function parse({
  focus,
  lineNums,
  annotations,
  highlightedLines,
  lang,
}: ParseInput) {
  const normalCode = getCode(highlightedLines)

  const lineNumsFullTween = {
    prev: lineNums.prev ?? `1:${normalCode.prev.length}`,
    next: lineNums.next ?? `1:${normalCode.next.length}`,
  }

  const indexToLineNumberMap = map(
    lineNumsFullTween,
    getLineNumIndexes
  )
  const lineNumberToIndexMap = map(
    indexToLineNumberMap,
    mp =>
      mp.reduce(
        (acc, ln, index) => acc.set(ln, index),
        new Map<number, number>()
      )
  )

  const mergedCode = merge(
    normalCode,
    highlightedLines,
    indexToLineNumberMap
  )

  const { inlineAnnotations, multilineAnnotations } =
    parseAllAnnotations(annotations)

  const maxLineNumber = map(indexToLineNumberMap, mp =>
    Math.max(10, mp[mp.length - 1])
  )
  const focusedCode = splitLinesByFocus(
    mergedCode,
    withDefault(focus, null),
    inlineAnnotations,
    lineNumberToIndexMap
  )

  const annotatedCode = addAnnotations(
    focusedCode,
    inlineAnnotations,
    multilineAnnotations
  )

  const codeStep = addExtraStuff(
    annotatedCode,
    normalCode,
    lineNumberToIndexMap,
    maxLineNumber,
    lang
  )

  return codeStep
}

// 0 - normalize

function getCode(
  highlightedLines: FullTween<HighlightedLine[]>
): FullTween<string> {
  return map(highlightedLines, lines =>
    lines
      .map(line => line.tokens.map(t => t.content).join(""))
      .join("\n")
      .trimEnd()
      .concat("\n")
  )
}

// 1 - highlight

type HighlightedToken = {
  content: string
  props: { style?: React.CSSProperties }
}

export type HighlightedLine = {
  tokens: HighlightedToken[]
}

// 2 - merge lines

type Movement = "enter" | "exit" | "stay"

export type MergedLine = {
  tokens: HighlightedToken[]
  lineNumber: Tween<number>
  move: Movement
  enterIndex: null | number
  exitIndex: null | number
}

export interface MergedCode {
  lines: MergedLine[]
  enterCount: number
  exitCount: number
}

function merge(
  code: FullTween<string>,
  highlightedLines: FullTween<HighlightedLine[]>,
  lineNumbersMap: FullTween<number[]>
): MergedCode {
  return mergeLines(code, highlightedLines, lineNumbersMap)
}

// 3 - parse annotationss

export type MultiLineAnnotation = {
  /* line numbers (starting at 1) */
  lineNumbers: { start: number; end: number }
  data: any
  Component: (props: {
    style: React.CSSProperties
    children: React.ReactNode
    data: any
    isInline: boolean
    lines?: LineWithElement[]
  }) => React.ReactElement
}

export type InlineAnnotation = {
  /* column numbers (starting at 1) */
  columnNumbers: { start: number; end: number }
  data: any
  Component: (props: {
    style?: React.CSSProperties
    children: React.ReactNode
    data: any
    isInline: boolean
  }) => React.ReactElement
}

function parseAllAnnotations(
  annotations:
    | Tween<CodeAnnotation[] | undefined>
    | undefined
) {
  return parseAnnotations(annotations)
}

// 4 - split lines by focus

export type TokenGroup = {
  tokens: HighlightedToken[]
  focused: FullTween<boolean>
  element: React.ReactNode
}

export interface FocusedLine
  extends Omit<MergedLine, "tokens"> {
  groups: TokenGroup[]
  lineNumber: Tween<number>
  focused: FullTween<boolean>
}

export interface FocusedCode
  extends Omit<MergedCode, "lines"> {
  lines: FocusedLine[]
  firstFocusedLineNumber: FullTween<number>
  lastFocusedLineNumber: FullTween<number>
}

function splitLinesByFocus(
  mergedCode: MergedCode,
  focus: FullTween<FocusString>,
  annotations: FullTween<
    Record<number, InlineAnnotation[] | undefined>
  >,
  lineNumberToIndexMap: FullTween<Map<number, number>>
): FocusedCode {
  return splitByFocus(
    mergedCode,
    focus,
    annotations,
    lineNumberToIndexMap
  )
}

// 5 - add annotations

export type AnnotatedTokenGroups = {
  groups: TokenGroup[]
  annotation?: InlineAnnotation
}

export interface AnnotatedLine
  extends Omit<FocusedLine, "groups"> {
  annotatedGroups: Tween<AnnotatedTokenGroups>[]
}

export type LineGroup = {
  annotation?: MultiLineAnnotation
  lines: AnnotatedLine[]
}
export interface AnnotatedCode
  extends Omit<FocusedCode, "lines"> {
  lineGroups: FullTween<LineGroup[]>
  firstFocusedLineNumber: FullTween<number>
  lastFocusedLineNumber: FullTween<number>
  lineCount: FullTween<number>
}

function addAnnotations(
  { lines, ...focusedCode }: FocusedCode,
  inlineAnnotations: FullTween<
    Record<number, InlineAnnotation[] | undefined>
  >,
  annotations: FullTween<MultiLineAnnotation[]>
): AnnotatedCode {
  const annotatedLines = annotateInline(
    lines,
    inlineAnnotations
  ) as AnnotatedLine[]

  const lineGroups = annotateMultiline(
    annotatedLines,
    annotations
  )

  return {
    ...focusedCode,
    lineGroups: lineGroups,
    lineCount: {
      prev: lines.filter(l => l.lineNumber.prev != null)
        .length,
      next: lines.filter(l => l.lineNumber.next != null)
        .length,
    },
  }
}

// - add extra stuff

export type LineWithElement = AnnotatedLine & {
  key: number
  tweenX: TweenParams
  tweenY: TweenParams
}
type LineGroupWithElement = {
  annotation?: MultiLineAnnotation
  lines: LineWithElement[]
}

export type CodeShift = {
  groups: FullTween<LineGroupWithElement[]>
  firstFocusedLineNumber: FullTween<number>
  lastFocusedLineNumber: FullTween<number>
  verticalInterval: [number, number]
  lineCount: FullTween<number>
  maxLineNumber: FullTween<number>
  code: FullTween<string>
  lang: string
}

function addExtraStuff(
  codeStep: AnnotatedCode,
  code: FullTween<string>,
  lineNumberToIndexMap: FullTween<Map<number, number>>,
  maxLineNumber: FullTween<number>,
  lang: string
): CodeShift {
  const vInterval = verticalInterval(
    codeStep.enterCount,
    codeStep.exitCount
  )

  const newGroups = map(codeStep.lineGroups, groups =>
    groups.map(group => ({
      ...group,
      lines: getLinesWithElements(
        group.lines,
        lineNumberToIndexMap,
        vInterval,
        codeStep.enterCount,
        codeStep.exitCount
      ),
    }))
  )

  return {
    ...codeStep,
    groups: newGroups,
    verticalInterval: vInterval,
    code,
    maxLineNumber,
    lang,
  }
}

function verticalInterval(
  enterCount: number,
  exitCount: number
): [number, number] {
  if (enterCount <= 0 && exitCount <= 0) return [0, 1]
  if (enterCount <= 0 && exitCount >= 1) return [0.33, 1]
  if (enterCount >= 1 && exitCount <= 0) return [0, 0.67]
  return [0.25, 0.75]
}
