import React, { useCallback, useMemo } from "react"
import { EditorStep } from "../mini-editor"
import { InnerCode, updateEditorStep } from "./code"
import { Scroller, Step as ScrollerStep } from "../scroller"
import { Preview, PresetConfig } from "./preview"
import { LinkableSection } from "./section"
import { extractPreviewSteps } from "./steps"
import { Swap } from "./ssmq"
import { StaticStepContext } from "./slots"
import {
  CodeConfigProps,
  ElementProps,
  GlobalConfig,
} from "../core/types"

type ScrollycodingProps = {
  globalConfig: GlobalConfig
  // data
  children: React.ReactNode
  editorSteps: EditorStep[]
  presetConfig?: PresetConfig
  hasPreviewSteps?: boolean
  // custom props
  staticMediaQuery?: string
  start?: number
  enableScroller?: boolean
  // more things like : rows, showCopyButton, showExpandButton, lineNumbers, staticMediaQuery
} & CodeConfigProps &
  ElementProps

export function Scrollycoding(props: ScrollycodingProps) {
  const staticMediaQuery =
    props.staticMediaQuery ??
    props.globalConfig.staticMediaQuery
  return (
    <Swap
      query={staticMediaQuery}
      staticElement={<StaticScrollycoding {...props} />}
    >
      <DynamicScrollycoding {...props} />
    </Swap>
  )
}

function StaticScrollycoding({
  globalConfig,
  // data
  children,
  editorSteps,
  presetConfig,
  hasPreviewSteps,
  // local config
  staticMediaQuery,
  start = 0,
  enableScroller = true,
  // element props:
  className,
  style,
  // code config props
  ...codeConfigProps
}: ScrollycodingProps) {
  const { stepsChildren, previewChildren } =
    extractPreviewSteps(children, hasPreviewSteps)
  return (
    <section
      className={`ch-scrollycoding-static ${
        className || ""
      }`}
      data-ch-theme={globalConfig.themeName}
      style={style}
    >
      {stepsChildren.map((children, i) => (
        <StaticSection
          key={i}
          editorStep={editorSteps[i]}
          previewStep={
            previewChildren && previewChildren[i]
          }
          presetConfig={presetConfig}
          codeConfigProps={codeConfigProps}
          globalConfig={globalConfig}
        >
          {children}
        </StaticSection>
      ))}
    </section>
  )
}

function StaticSection({
  editorStep,
  previewStep,
  children,
  presetConfig,
  codeConfigProps,
  globalConfig,
}: {
  editorStep: EditorStep
  previewStep: React.ReactNode
  children: React.ReactNode
  presetConfig?: PresetConfig
  codeConfigProps: CodeConfigProps
  globalConfig: GlobalConfig
}) {
  const [step, setStep] = React.useState({
    editorStep,
    previewStep,
    presetConfig,
    codeConfigProps,
    selectedId: undefined,
  })

  const resetFocus = () =>
    setStep({
      editorStep,
      previewStep,
      presetConfig,
      codeConfigProps,
      selectedId: undefined,
    })
  const setFocus = ({
    fileName,
    focus,
    id,
  }: {
    fileName?: string
    focus: string | null
    id: string
  }) => {
    const newEditorStep = updateEditorStep(
      step.editorStep,
      fileName,
      focus
    )

    setStep({
      ...step,
      editorStep: newEditorStep,
      selectedId: id,
    })
  }

  return (
    <StaticStepContext.Provider
      value={{
        ...step,
        setFocus,
        globalConfig,
      }}
    >
      <LinkableSection
        onActivation={setFocus}
        onReset={resetFocus}
      >
        {children}
      </LinkableSection>
    </StaticStepContext.Provider>
  )
}

function DynamicScrollycoding({
  id,
  globalConfig,
  // data
  children,
  editorSteps,
  presetConfig,
  hasPreviewSteps,
  // local config
  staticMediaQuery,
  start = 0,
  enableScroller = true,
  // element props:
  className,
  style,
  // code config props
  ...codeConfigProps
}: ScrollycodingProps) {
  const { stepsChildren, previewChildren } =
    extractPreviewSteps(children, hasPreviewSteps)

  const withPreview = presetConfig || hasPreviewSteps

  const [state, setState] = React.useState({
    stepIndex: start,
    step: editorSteps[start],
  })

  const tab = state.step

  function onStepChange(index: number) {
    window.postMessageToCodeNoteEditor?.(
      "on-scrolly-step-change",
      {
        id,
        stepIndex: index,
      }
    )
    setState({ stepIndex: index, step: editorSteps[index] })
  }

  function onStepChangeByScroller(index: number) {
    if (enableScroller) {
      onStepChange(index)
    }
  }

  function onTabClick(filename: string) {
    const newStep = updateEditorStep(
      state.step,
      filename,
      null
    )
    setState({ ...state, step: newStep })
  }

  function onLinkActivation(
    stepIndex: number,
    filename: string | undefined,
    focus: string | null
  ) {
    const newStep = updateEditorStep(
      editorSteps[stepIndex],
      filename,
      focus
    )
    setState({ ...state, stepIndex, step: newStep })
  }

  const ref = React.useRef<HTMLDivElement>(null)
  const height = 800 // TODO: dynamic height
  const stickerStyle = height
    ? {
        height: height * 0.8,
        top: height * 0.1,
      }
    : {}
  return (
    <section
      className={`ch-scrollycoding ${
        withPreview ? "ch-scrollycoding-with-preview" : ""
      } ${className || ""}`}
      style={{ ...style }}
      data-ch-theme={globalConfig?.themeName}
    >
      <div className="ch-scrollycoding-content ignore-activate">
        <Scroller
          onStepChange={onStepChangeByScroller}
          triggerPosition={globalConfig?.triggerPosition}
          height={height}
        >
          {stepsChildren.map((children, i) => {
            const cb = () => onStepChange(i)
            return (
              <ScrollerStep
                as="div"
                key={i}
                index={i}
                onClick={cb}
                className="ch-scrollycoding-step-content"
                data-selected={
                  i === state.stepIndex ? "true" : undefined
                }
              >
                <LinkableSection
                  onActivation={({ fileName, focus }) => {
                    onLinkActivation(i, fileName, focus)
                  }}
                  onReset={cb}
                >
                  {children}
                </LinkableSection>
              </ScrollerStep>
            )
          })}
        </Scroller>
      </div>
      <div
        className="ch-scrollycoding-sticker"
        ref={ref}
        style={stickerStyle}
      >
        <InnerCode
          editorStep={tab}
          globalConfig={globalConfig}
          onTabClick={onTabClick}
          codeConfigProps={{
            showExpandButton: true,
            ...codeConfigProps,
            rows: undefined, // rows are not supported in scrollycoding
          }}
        />
        {presetConfig ? (
          <Preview
            className="ch-scrollycoding-preview"
            files={tab.files}
            globalConfig={globalConfig}
            presetConfig={presetConfig}
          />
        ) : hasPreviewSteps ? (
          <Preview
            className="ch-scrollycoding-preview"
            {...previewChildren[state.stepIndex]["props"]}
            globalConfig={globalConfig}
          />
        ) : null}
      </div>
    </section>
  )
}

/*
import { useEffect, useRef, useState } from "react"

import type { CSSProperties, RefObject } from "react"

import { useIsMounted } from "usehooks-ts"

type Size = {
  width: number | undefined
  height: number | undefined
}

type UseResizeObserverOptions<
  T extends HTMLElement = HTMLElement
> = {
  ref: RefObject<T>
  onResize?: (size: Size) => void
  box?:
    | "border-box"
    | "content-box"
    | "device-pixel-content-box"
}

const initialSize: Size = {
  width: undefined,
  height: undefined,
}

export function useResizeObserver<
  T extends HTMLElement = HTMLElement
>(options: UseResizeObserverOptions<T>): Size {
  const { ref, box = "content-box" } = options
  const [{ width, height }, setSize] =
    useState<Size>(initialSize)
  const isMounted = useIsMounted()
  const previousSize = useRef<Size>({ ...initialSize })
  const onResize = useRef<
    ((size: Size) => void) | undefined
  >(undefined)
  onResize.current = options.onResize

  useEffect(() => {
    if (!ref.current) return () => {}

    if (
      typeof window === "undefined" ||
      !("ResizeObserver" in window)
    )
      return () => {}

    const observer = new ResizeObserver(([entry]) => {
      const boxProp =
        box === "border-box"
          ? "borderBoxSize"
          : box === "device-pixel-content-box"
          ? "devicePixelContentBoxSize"
          : "contentBoxSize"

      const newWidth = extractSize(
        entry,
        boxProp,
        "inlineSize"
      )
      const newHeight = extractSize(
        entry,
        boxProp,
        "blockSize"
      )

      const hasChanged =
        previousSize.current.width !== newWidth ||
        previousSize.current.height !== newHeight

      if (hasChanged) {
        const newSize: Size = {
          width: newWidth,
          height: newHeight,
        }
        previousSize.current.width = newWidth
        previousSize.current.height = newHeight

        if (onResize.current) {
          onResize.current(newSize)
        } else {
          if (isMounted()) {
            setSize(newSize)
          }
        }
      }
    })

    observer.observe(ref.current, { box })

    return () => {
      observer.disconnect()
    }
  }, [box, ref, isMounted])

  return { width, height }
}

type BoxSizesKey = keyof Pick<
  ResizeObserverEntry,
  | "borderBoxSize"
  | "contentBoxSize"
  | "devicePixelContentBoxSize"
>

function extractSize(
  entry: ResizeObserverEntry,
  box: BoxSizesKey,
  sizeType: keyof ResizeObserverSize
): number | undefined {
  if (!entry[box]) {
    if (box === "contentBoxSize") {
      return entry.contentRect[
        sizeType === "inlineSize" ? "width" : "height"
      ]
    }
    return undefined
  }

  return Array.isArray(entry[box])
    ? entry[box][0][sizeType]
    : // @ts-ignore Support Firefox's non-standard behavior
      (entry[box][sizeType] as number)
}
*/
