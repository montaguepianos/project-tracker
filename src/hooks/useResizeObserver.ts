import { useEffect, useRef, useState } from 'react'

type Size = {
  width: number
  height: number
}

export function useResizeObserver<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const updateSize = () => {
      setSize({ width: element.clientWidth, height: element.clientHeight })
    }

    updateSize()

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setSize({ width, height })
      }
    })

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [])

  return { ref, ...size }
}
