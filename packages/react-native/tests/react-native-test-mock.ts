import { vi } from 'vitest'

vi.mock('react-native', async () => {
  const React = await import('react')
  const { TestAnimatedValue } = await import('./test-animated-value.js')
  const { horizontalScrollTo, verticalScrollTo } = await import('./test-spies.js')

  const createPrimitive = (name: string) =>
    React.forwardRef(function Primitive(
      { children, ...props }: React.PropsWithChildren<object>,
      ref
    ) {
      return React.createElement(name, { ...props, ref }, children)
    })

  const ScrollView = React.forwardRef(function TestScrollView(
    { children, testID, ...props }: React.PropsWithChildren<{ readonly testID?: string }>,
    ref
  ) {
    const scrollTo = testID?.includes('horizontal') ? horizontalScrollTo : verticalScrollTo
    React.useImperativeHandle(ref, () => ({ scrollTo }))
    return React.createElement('ScrollView', { ...props, testID }, children)
  })

  const applyAnimatedValues = (mapping: unknown, value: unknown): void => {
    if (mapping instanceof TestAnimatedValue && typeof value === 'number') {
      mapping.setValue(value)
      return
    }
    if (
      typeof mapping !== 'object' ||
      mapping === null ||
      typeof value !== 'object' ||
      value === null
    )
      return
    for (const [key, child] of Object.entries(mapping)) {
      applyAnimatedValues(child, (value as Record<string, unknown>)[key])
    }
  }

  return {
    Animated: {
      Value: TestAnimatedValue,
      View: createPrimitive('AnimatedView'),
      ScrollView,
      add: (value: TestAnimatedValue, offset: number) => ({
        getValue: () => value.getValue() + offset
      }),
      event:
        (mappings: readonly unknown[], options: { readonly listener?: (event: unknown) => void }) =>
        (event: unknown) => {
          applyAnimatedValues(mappings[0], event)
          options.listener?.(event)
        }
    },
    ScrollView,
    Pressable: createPrimitive('Pressable'),
    StyleSheet: { create: <Style>(styles: Style) => styles, hairlineWidth: 1 },
    Text: createPrimitive('Text'),
    View: createPrimitive('View'),
    Image: createPrimitive('Image')
  }
})
